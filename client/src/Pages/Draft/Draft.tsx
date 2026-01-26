import React, { Component, FormEvent, ChangeEvent } from 'react';
import { Form, Button, Table, Alert, Badge } from 'react-bootstrap';
import { io, Socket } from 'socket.io-client';
import { SessionState } from '../../types/session';

interface DraftState {
  connected: boolean;
  player_name: string;
  session_id: string | null;
  token: string | null;

  owner: string | null;
  players: SessionState['players'];
  canStart: boolean;

  error: string | null;
}

export class Draft extends Component<Record<string,never>, DraftState> {
  socket: Socket | null = null;

  state: DraftState = {
    connected: false,
    player_name: localStorage.getItem('player_name') || '',
    session_id: localStorage.getItem('session_id'),
    token: localStorage.getItem('token'),

    owner: null,
    players: [],
    canStart: false,

    error: null,
  };

  componentWillUnmount() {
    this.socket?.disconnect();
  }

  connectSocket = (e?: FormEvent) => {
    e?.preventDefault();
    if (this.socket) return;

    this.socket = io(import.meta.env.VITE_BACKEND_API);

    this.socket.on('connect', () => {
      this.setState({ connected: true, error: null });

      if (this.state.token) this.socket?.emit('authenticate', this.state.token);

      if (this.state.session_id && this.state.player_name) {
        this.socket?.emit('joinSession', this.state.session_id, this.state.player_name);
      }
    });

    this.socket.on('authenticated', (token: string) => {
      localStorage.setItem('token', token);
      this.setState({ token });
    });

    this.socket.on('sessionState', (state: SessionState) => {
      this.setState({
        session_id: state.session_id,
        owner: state.owner,
        players: state.players,
        canStart: state.canStart,
      });
    });

    this.socket.on('sessionError', (error: string) => {
      this.setState({ error });
      localStorage.removeItem('session_id');
    });

    this.socket.on('disconnect', () => {
      this.setState({ connected: false });
    });
  };

  handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const player_name = e.target.value;
    this.setState({ player_name });
    localStorage.setItem('player_name', player_name);
  };

  createSession = async () => {
    const res = await fetch(import.meta.env.VITE_BACKEND_API + 'createSession', {
      method: 'POST',
    });
    const { session_id }: { session_id: string } = await res.json();

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket?.emit('joinSession', session_id, this.state.player_name);
    });
  };

  joinSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const session_id = (form.elements.namedItem('session_id') as HTMLInputElement).value;

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket?.emit('joinSession', session_id, this.state.player_name);
    });
  };

  toggleReady = () => {
    this.socket?.emit('ready', this.state.session_id);
  };

  startDraft = () => {
    this.socket?.emit('startDraft', this.state.session_id);
  };

  render() {
    const { connected, player_name, session_id, players, owner, canStart, error } = this.state;
    const isOwner = owner === player_name;

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
            <Button className="mt-2" type="submit">Connect</Button>
          </Form>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {connected && !session_id && (
          <>
            <Form onSubmit={this.joinSession}>
              <Form.Control name="session_id" placeholder="Session ID" />
              <Button type="submit" className="mt-2">Join Session</Button>
            </Form>
            <Button className="mt-2" onClick={this.createSession}>Create Session</Button>
          </>
        )}

        {connected && session_id && (
          <>
            <h4>
              Session: {session_id} {isOwner && <Badge bg="primary">Owner</Badge>}
            </h4>

            <Table striped bordered size="sm">
              <tbody>
                {players.map((p) => (
                  <tr key={p.name}>
                    <td>
                      {p.name}{' '}
                      {p.isOwner && <Badge bg="info">Host</Badge>}
                      {!p.connected && <Badge bg="secondary" className="ms-1">Bot</Badge>}
                    </td>
                    <td>
                      {p.ready ? (
                        <Badge bg="success">{p.connected ? 'Ready' : 'Bot'}</Badge>
                      ) : (
                        <Badge bg="secondary">{p.connected ? 'Not ready' : 'Bot'}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Only allow humans to toggle ready */}
            {players.some(p => p.name === player_name && !p.isOwner && !players.find(x => x.name === player_name)?.connected) ? null : (
              <Button onClick={this.toggleReady} className="me-2">Toggle Ready</Button>
            )}

            {isOwner && (
              <Button
                variant="success"
                disabled={!canStart}
                onClick={this.startDraft}
              >
                Start Draft
              </Button>
            )}
          </>
        )}
      </div>
    );
  }
}

