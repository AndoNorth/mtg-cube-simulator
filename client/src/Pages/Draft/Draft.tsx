import React, { Component, FormEvent, ChangeEvent } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { io, Socket } from 'socket.io-client';
import { SessionState } from '../../types/session';
import { DraftStatePayload } from '../../types/draft';
import { Lobby } from './Lobby';
import { DraftView } from './DraftView';

interface DraftState {
  connected: boolean;
  player_name: string;
  session_id: string | null;
  join_session_id: string;
  token: string | null;

  owner: string | null;
  players: SessionState['players'];
  canStart: boolean;

  disconnectedPlayers: Record<string, number>;
  draftData: DraftStatePayload | null;
  error: string | null;
}

export class Draft extends Component<Record<string, never>, DraftState> {
  socket: Socket | null = null;

  constructor(props: Record<string, never>) {
    super(props);

    this.state = {
      connected: false,
      player_name: localStorage.getItem('player_name') || '',
      session_id: localStorage.getItem('session_id'),
      join_session_id: '',
      token: localStorage.getItem('token'),

      owner: null,
      players: [],
      disconnectedPlayers: {},
      canStart: false,
      draftData: null,

      error: null,
    };
  }

  componentWillUnmount() {
    this.socket?.disconnect();
  }

  componentDidMount() {
    setInterval(() => {
      this.setState(prev => {
        const updated: Record<string, number> = {};
        for (const name in prev.disconnectedPlayers) {
          if (prev.disconnectedPlayers[name] > 0) {
            updated[name] = prev.disconnectedPlayers[name] - 1;
          }
        }
        return { disconnectedPlayers: updated };
      });
    }, 1000);
  }

  // --------------------
  // Connection
  // --------------------
  connectSocket = (e?: FormEvent) => {
    e?.preventDefault();
    if (this.socket) return;

    this.socket = io(import.meta.env.VITE_BACKEND_API);

    this.socket.on('connect', () => {
      this.setState({ connected: true, error: null });

      if (this.state.token) {
        this.socket?.emit('authenticate', this.state.token);
      }

      if (this.state.session_id && this.state.player_name) {
        this.socket?.emit(
          'joinSession',
          this.state.session_id,
          this.state.player_name
        );
      }
    });

    this.socket.on('authenticated', (token: string) => {
      localStorage.setItem('token', token);
      this.setState({ token });
    });

    this.socket.on('sessionState', (state: SessionState) => {
      const newDisconnected: Record<string, number> = {};

      state.players.forEach(p => {
        if (p.disconnected != null) {
          // Use the value sent by server (in seconds)
          newDisconnected[p.name] = p.disconnected;
        }
      });

      this.setState({
        session_id: state.session_id,
        owner: state.owner,
        players: state.players,
        canStart: state.canStart,
        disconnectedPlayers: newDisconnected,
      });
    });

    this.socket.on('draftState', (state: DraftStatePayload) => {
      this.setState({ draftData: state });
    });

    this.socket.on('draftError', (error: string) => {
      this.setState({ error });
    });

    this.socket.on('sessionError', (error: string) => {
      this.setState({ error, session_id: null });
      localStorage.removeItem('session_id');
    });

    this.socket.on('disconnect', () => {
      this.setState({ connected: false });
    });
  };

  // --------------------
  // Form handlers
  // --------------------
  handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const player_name = e.target.value;
    this.setState({ player_name });
    localStorage.setItem('player_name', player_name);
  };

  handleJoinSessionChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ join_session_id: e.target.value });
  };

  joinSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const session_id = this.state.join_session_id.trim();
    if (!session_id) return;

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket?.emit('joinSession', session_id, this.state.player_name);
    });
  };

  createSession = async () => {
    const res = await fetch(
      import.meta.env.VITE_BACKEND_API + 'createSession',
      { method: 'POST' }
    );
    const { session_id }: { session_id: string } = await res.json();

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket?.emit('joinSession', session_id, this.state.player_name);
    });
  };

  // --------------------
  // Lobby actions
  // --------------------
  toggleReady = () => {
    this.socket?.emit('ready', this.state.session_id);
  };

  startDraft = () => {
    this.socket?.emit('startDraft', this.state.session_id);
  };

  leaveSession = () => {
    this.socket?.emit('leaveSession', this.state.session_id);
    localStorage.removeItem('session_id');
    this.setState({ session_id: null });
  };

  kickPlayer = (playerName: string) => {
    this.socket?.emit('kickPlayer', this.state.session_id, playerName);
  };

  movePlayer = (playerName: string, dir: 'up' | 'down') => {
    this.socket?.emit('reorderPlayer', this.state.session_id, playerName, dir);
  };

  pickCard = (cardId: number) => {
    this.socket?.emit('pickCard', this.state.session_id, cardId);
  };

  // --------------------

  render() {
    const {
      connected,
      player_name,
      session_id,
      join_session_id,
      players,
      owner,
      canStart,
      draftData,
      error,
    } = this.state;

    return (
      <div>
        {!connected && (
          <Form onSubmit={this.connectSocket}>
            <Form.Control
              value={player_name}
              onChange={this.handleNameChange}
              placeholder="Enter your name"
              required
            />
            <Button className="mt-2" type="submit">
              Connect
            </Button>
          </Form>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {connected && !session_id && (
          <>
            <Form onSubmit={this.joinSession}>
              <Form.Control
                name="session_id"
                placeholder="Session ID"
                value={join_session_id}
                onChange={this.handleJoinSessionChange}
              />
              <Button type="submit" className="mt-2">
                Join Session
              </Button>
            </Form>

            <Button className="mt-2" onClick={this.createSession}>
              Create Session
            </Button>
          </>
        )}

        {connected && session_id && draftData && (
          <DraftView
            draftState={draftData}
            onPickCard={this.pickCard}
          />
        )}

        {connected && session_id && !draftData && (
          <Lobby
            sessionId={session_id}
            selfName={player_name}
            owner={owner}
            players={players.map(p => ({ ...p, ready: p.ready || !p.connected }))}
            disconnectedPlayers={this.state.disconnectedPlayers}
            canStart={canStart}
            onToggleReady={this.toggleReady}
            onStartDraft={this.startDraft}
            onLeave={this.leaveSession}
            onKick={this.kickPlayer}
            onMove={this.movePlayer}
          />
        )}
      </div>
    );
  }
}

