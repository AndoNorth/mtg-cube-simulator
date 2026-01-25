import { DraftingSession } from './game';

describe('Draft Setup', () => {
  test('Simulate a draft setup', () => {
    const pack_size: number = 15;
    const no_packs: number = 3;
    const no_players: number = 8;

    const draft = new DraftingSession(pack_size, no_packs, no_players);

    // Initialize session
    draft.createSession();

    // Simulate full draft
    draft.simulateDraft();

    expect(draft.m_players.length).toBeLessThanOrEqual(no_players);
    expect(draft.m_packs.length).toBe(pack_size * no_packs * no_players / pack_size); // each pack has pack_size cards
    expect(draft.m_draft_pool.length).toBeLessThanOrEqual(pack_size * no_packs * no_players);
  });
});

