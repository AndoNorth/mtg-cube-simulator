import { Button, Table, Badge } from 'react-bootstrap';
import { SessionState } from '../../types/session';

interface LobbyProps {
  sessionId: string;
  selfName: string;
  owner: string | null;
  players: SessionState['players'];
  disconnectedPlayers: Record<string, number>;
  canStart: boolean;

  onToggleReady(): void;
  onStartDraft(): void;
  onLeave(): void;
  onKick(playerName: string): void;
  onMove(playerName: string, dir: 'up' | 'down'): void;
}

export function Lobby({
  sessionId,
  selfName,
  // owner,
  players,
  disconnectedPlayers,
  canStart,
  onToggleReady,
  onStartDraft,
  onLeave,
  onKick,
  onMove,
}: LobbyProps) {
  const self = players.find(p => p.name === selfName);
  const isOwner = self?.isOwner ?? false;
  const isConnected = self?.connected ?? false;

  return (
    <>
      <h4>
        Session: {sessionId}{' '}
        {isOwner && <Badge bg="primary">Owner</Badge>}
      </h4>

      <Table striped bordered size="sm">
        <tbody>
          {players.map((p, idx) => {
            const isSelf = p.name === selfName;
            const isBot = !p.connected;
            const isReady = p.ready;

            return (
              <tr key={p.name}>
                <td>
                  {p.name}{' '}
                  {p.isOwner && <Badge bg="info">Host</Badge>}
                  {isBot && <Badge bg="secondary" className="ms-1">Bot</Badge>}
                </td>
                <td>
                  {isBot
                    ? <Badge bg="dark">Bot</Badge>
                    : !isConnected
                    ? <>
                      <Badge bg="warning">Disconnected</Badge>
                      {disconnectedPlayers[p.name] != null && (
                        <Badge bg="warning" className="ms-1">
                          {disconnectedPlayers[p.name]}s
                        </Badge>
                      )}
                      </>
                    : isReady
                      ? <Badge bg="success">Ready</Badge>
                      : <Badge bg="secondary">Not ready</Badge>
                  }
                </td>
                <td className="text-nowrap">
                  {isOwner && (
                    <>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-1"
                        disabled={idx === 0}
                        onClick={() => onMove(p.name, 'up')}
                      >↑</Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="me-2"
                        disabled={idx === players.length - 1}
                        onClick={() => onMove(p.name, 'down')}
                      >↓</Button>

                      {!isSelf && !isBot && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => onKick(p.name)}
                        >Kick</Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="d-flex gap-2">
        {isConnected && <Button onClick={onToggleReady}>Toggle Ready</Button>}

        {isConnected && (
          <Button
            variant="outline-danger"
            onClick={onLeave}
          >
            Leave Session
          </Button>
        )}

        {isOwner && (
          <Button
            variant="success"
            disabled={!canStart}
            onClick={onStartDraft}
          >
            Start Draft
          </Button>
        )}
      </div>
    </>
  );
}

