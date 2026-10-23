import { describe, it, expect } from 'vitest';
import { pickNpcUpdatableFields } from '../../../src/domain/character/npcUpdate.js';

describe('fields an NPC edit may change', () => {
    it('keeps identity, race, stats and progression exactly as sent', () => {
        const body = {
            name: 'Mira', surname: 'Vale', age: 40, gender: 'female', background: 'Innkeeper',
            imageUrl: '/uploads/mira.jpg', raceId: 2, stats: { for: 8, hp: 60 },
            rank: 3, experience: 120, skillPoints: 4, statPoints: 1
        };

        const result = pickNpcUpdatableFields(body);

        expect(result).toEqual({
            name: 'Mira', surname: 'Vale', age: 40, gender: 'female', background: 'Innkeeper',
            imageUrl: '/uploads/mira.jpg', raceId: 2, stats: { for: 8, hp: 60 },
            rank: 3, experience: 120, skillPoints: 4, statPoints: 1
        });
    });

    it.each([
        ['the owner', { userId: 7 }],
        ['whether it is an NPC', { isNPC: false }],
        ['whether it is active', { isActive: true }],
        ['the row id', { id: 99 }],
        ['the creator', { createdBy: 3 }],
        ['the creation time', { createdAt: '2020-01-01' }],
        ['a column that does not exist', { health: 10 }],
    ])('an edit cannot change %s', (_name, forbidden) => {
        const result = pickNpcUpdatableFields({ name: 'Mira', ...forbidden });

        expect(result).toEqual({ name: 'Mira' });
    });

    it('a field that was not sent is left out, so the stored value is kept', () => {
        const result = pickNpcUpdatableFields({ rank: 2 });

        expect(result).toEqual({ rank: 2 });
    });

    it('a field sent as zero or empty text is kept', () => {
        const result = pickNpcUpdatableFields({ experience: 0, background: '' });

        expect(result).toEqual({ experience: 0, background: '' });
    });

    it('an edit with only forbidden fields changes nothing', () => {
        const result = pickNpcUpdatableFields({ userId: 7, isNPC: false });

        expect(result).toEqual({});
    });
});
