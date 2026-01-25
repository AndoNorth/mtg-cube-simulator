import React, { Component } from 'react';
import { Form, Button, Table, Alert, Badge } from 'react-bootstrap';
import io from 'socket.io-client';

export class Draft extends Component {
  socket = null;

  state = {
    connected: false,
    player_name: localStorage.getItem('player_name') || '',
    session_id: localStorage.getItem('session_id'),
    token: localStorage.getItem('token'),

    // server-driven state
    owner: null,
    players: [],
    canStart: false,

    error: null,
  };

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // --------------------
  // Socket connection
  // --------------------
  connectSocket = (e) => {
    e?.preventDefault();
    if (this.socket) return;

    this.socket = io(import.meta.env.VITE_BACKEND_API);

    this.socket.on('connect', () => {
      this.setState({ connected: true, error: null });

      if (this.state.token) {
        this.socket.emit('authenticate', this.state.token);
      }

      if (this.state.session_id && this.state.player_name) {
        this.socket.emit(
          'joinSession',
          this.state.session_id,
          this.state.player_name
        );
      }
    });

    this.socket.on('authenticated', (token) => {
      localStorage.setItem('token', token);
      this.setState({ token });
    });

    this.socket.on('sessionState', (state) => {
      this.setState({
        session_id: state.session_id,
        owner: state.owner,
        players: state.players,
        canStart: state.canStart,
      });
    });

    this.socket.on('sessionError', (error) => {
      this.setState({ error });
      localStorage.removeItem('session_id');
    });

    this.socket.on('disconnect', () => {
      this.setState({ connected: false });
    });
  };

  // --------------------
  // UI handlers
  // --------------------
  handleNameChange = (e) => {
    const player_name = e.target.value;
    this.setState({ player_name });
    localStorage.setItem('player_name', player_name);
  };

  createSession = async () => {
    const res = await fetch(
      import.meta.env.VITE_BACKEND_API + 'createSession',
      { method: 'POST' }
    );
    const { session_id } = await res.json();

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket.emit('joinSession', session_id, this.state.player_name);
    });
  };

  joinSession = (e) => {
    e.preventDefault();
    const session_id = e.target.session_id.value;

    localStorage.setItem('session_id', session_id);
    this.setState({ session_id }, () => {
      this.socket.emit('joinSession', session_id, this.state.player_name);
    });
  };

  toggleReady = () => {
    this.socket.emit('ready', this.state.session_id);
  };

  startDraft = () => {
    // future socket event
    this.socket.emit('startDraft', this.state.session_id);
  };

  // --------------------
  // Render
  // --------------------
  render() {
    const {
      connected,
      player_name,
      session_id,
      players,
      owner,
      canStart,
      error,
    } = this.state;

    const isOwner = owner === player_name;

    return (
      <div>
        {!connected && (
          <Form onSubmit={this.connectSocket}>
            <Form.Group>
              <Form.Control
                value={player_name}
                onChange={this.handleNameChange}
                placeholder="Enter your name"
                required
              />
            </Form.Group>
            <Button className="mt-2" type="submit">
              Connect
            </Button>
          </Form>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {connected && !session_id && (
          <>
            <Form onSubmit={this.joinSession}>
              <Form.Control name="session_id" placeholder="Session ID" />
              <Button type="submit" className="mt-2">
                Join Session
              </Button>
            </Form>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={this.createSession}
            >
              Create Session
            </Button>
          </>
        )}

        {connected && session_id && (
          <>
            <h4>
              Session: {session_id}{' '}
              {isOwner && <Badge bg="primary">Owner</Badge>}
            </h4>

            <Table striped bordered size="sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.name}>
                    <td>
                      {p.name}{' '}
                      {p.isOwner && <Badge bg="info">Host</Badge>}
                    </td>
                    <td>
                      {p.ready ? (
                        <Badge bg="success">Ready</Badge>
                      ) : (
                        <Badge bg="secondary">Not ready</Badge>
                      )}
                      {!p.connected && (
                        <Badge bg="warning" className="ms-2">
                          Disconnected
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Button onClick={this.toggleReady} className="me-2">
              Toggle Ready
            </Button>

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

