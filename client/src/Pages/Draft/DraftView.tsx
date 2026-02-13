import { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Badge, Button } from 'react-bootstrap';
import { DraftStatePayload, DraftPick } from '../../types/draft';

interface DraftViewProps {
  draftState: DraftStatePayload;
  onPickCard(cardId: number): void;
}

const NUM_LANES = 6;

export function DraftView({ draftState, onPickCard }: DraftViewProps) {
  const { currentRound, currentPick, totalRounds, packSize, draftFinished, pack, picks, waitingForOthers } = draftState;

  const [lanes, setLanes] = useState<DraftPick[][]>(() => Array.from({ length: NUM_LANES }, () => []));
  const [selectedCard, setSelectedCard] = useState<{ laneIdx: number; cardIdx: number } | null>(null);
  const processedPicksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLanes(prevLanes => {
      const updated = prevLanes.map(lane => [...lane]);
      const LANE_SOFT_LIMIT = 7;
      const newCards = picks.filter(p => !processedPicksRef.current.has(`${p.packNumber}-${p.pickNumber}`));

      for (const card of newCards) {
        processedPicksRef.current.add(`${card.packNumber}-${card.pickNumber}`);
        const laneWithLeastCards = updated.reduce((minIdx, lane, idx) =>
          updated[idx].length < updated[minIdx].length ? idx : minIdx, 0
        );
        if (updated[laneWithLeastCards].length < LANE_SOFT_LIMIT) {
          updated[laneWithLeastCards].push(card);
        } else {
          const firstNonFullLane = updated.findIndex(lane => lane.length < LANE_SOFT_LIMIT);
          if (firstNonFullLane !== -1) {
            updated[firstNonFullLane].push(card);
          } else {
            updated[laneWithLeastCards].push(card);
          }
        }
      }
      return updated;
    });
  }, [picks]);

  const handleLaneClick = (targetLaneIdx: number) => {
    if (!selectedCard) return;
    if (targetLaneIdx === selectedCard.laneIdx) {
      setSelectedCard(null);
      return;
    }

    setLanes(prev => {
      const updated = prev.map(lane => [...lane]);
      const [moved] = updated[selectedCard.laneIdx].splice(selectedCard.cardIdx, 1);
      updated[targetLaneIdx].push(moved);
      return updated;
    });
    setSelectedCard(null);
  };

  const handleCardClick = (laneIdx: number, cardIdx: number) => {
    if (selectedCard && selectedCard.laneIdx === laneIdx && selectedCard.cardIdx === cardIdx) {
      setSelectedCard(null);
    } else {
      setSelectedCard({ laneIdx, cardIdx });
    }
  };

  const canPick = !waitingForOthers && !draftFinished && pack.length > 0;

  const statusText = draftFinished
    ? 'Draft Complete!'
    : waitingForOthers
      ? 'Waiting for others...'
      : 'Pick a card';

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3">
        <Badge bg="primary">Round {currentRound + 1}/{totalRounds}</Badge>
        <Badge bg="secondary">Pick {currentPick + 1}/{packSize}</Badge>
        <span className="fw-bold">{statusText}</span>
      </div>

      <Row>
        <Col xs={6}>
          <h5>Pack ({pack.length} cards)</h5>
          <div className="d-flex flex-wrap gap-2">
            {pack.map(card => (
              <Card
                key={card.id}
                style={{ width: '120px', cursor: canPick ? 'pointer' : 'default', opacity: canPick ? 1 : 0.5 }}
                className="text-center"
                onClick={() => canPick && onPickCard(card.id)}
              >
                <Card.Body className="p-2">
                  <Card.Text style={{ fontSize: '0.8rem' }}>{card.name}</Card.Text>
                </Card.Body>
              </Card>
            ))}
            {pack.length === 0 && !draftFinished && (
              <span className="text-muted">Waiting...</span>
            )}
          </div>
        </Col>

        <Col xs={6}>
          <h5>Deck ({picks.length} cards)</h5>
          <div className="d-flex gap-2" style={{ overflowX: 'auto' }}>
            {lanes.map((lane, laneIdx) => (
              <div
                key={laneIdx}
                style={{
                  minWidth: '100px',
                  minHeight: '200px',
                  border: '1px dashed #ccc',
                  borderRadius: '4px',
                  padding: '4px',
                  backgroundColor: selectedCard && selectedCard.laneIdx !== laneIdx ? '#f0f8ff' : undefined,
                  cursor: selectedCard && selectedCard.laneIdx !== laneIdx ? 'pointer' : 'default',
                }}
                onClick={() => handleLaneClick(laneIdx)}
              >
                <div className="text-center mb-1">
                  <small className="text-muted">{laneIdx + 1}</small>
                </div>
                {lane.map((card, cardIdx) => (
                  <Button
                    key={`${card.packNumber}-${card.pickNumber}`}
                    variant={selectedCard?.laneIdx === laneIdx && selectedCard?.cardIdx === cardIdx ? 'primary' : 'outline-secondary'}
                    size="sm"
                    className="d-block w-100 mb-1 text-truncate"
                    style={{ fontSize: '0.7rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(laneIdx, cardIdx);
                    }}
                  >
                    {card.name}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </div>
  );
}
