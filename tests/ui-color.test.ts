//User-set colours. What this guards: the #hex test used to be copy-pasted at every call site, and the copies
//drifted. Chips, map layers and monitoring groups accepted a literal; the building tint and the home colour did
//not, because they wrapped the value in a var() name whatever it was, turning "#ff0000" into
//`var(--#ff0000-color)` -- meaningless, silently discarded, building stays grey. Same config, same thing to a
//user, two different answers. One resolver now, so they cannot drift again.

import { describe, it, expect } from 'vitest';
import { resolveUiColor } from '../src/core/format/format';

//No DOM: cssHex has nothing to read a theme var from, so a token can only fall back. That is what makes the hex
//path testable in isolation -- a literal must NOT need a theme at all.
const noEl = null;

describe('resolveUiColor', () => {
    it('passes a #hex straight through', () => {
        expect(resolveUiColor(noEl, '#ff0000', '#9e9e9e', 'grey')).toBe('#ff0000');
    });

    it('passes rgb() and rgba() straight through', () => {
        expect(resolveUiColor(noEl, 'rgb(1,2,3)', '#9e9e9e')).toBe('rgb(1,2,3)');
        expect(resolveUiColor(noEl, 'rgba(1,2,3,0.5)', '#9e9e9e')).toBe('rgba(1,2,3,0.5)');
    });

    it('trims a literal before deciding', () => {
        //A colour typed into YAML arrives with whatever spacing the user left.
        expect(resolveUiColor(noEl, '  #abcdef ', '#9e9e9e')).toBe('#abcdef');
    });

    it('is case-insensitive about the literal', () => {
        expect(resolveUiColor(noEl, '#ABCDEF', '#9e9e9e')).toBe('#ABCDEF');
        expect(resolveUiColor(noEl, 'RGB(1,2,3)', '#9e9e9e')).toBe('RGB(1,2,3)');
    });

    it('falls back to the hex when nothing is set and there is no token default', () => {
        expect(resolveUiColor(noEl, '', '#9e9e9e')).toBe('#9e9e9e');
        expect(resolveUiColor(noEl, undefined, '#9e9e9e')).toBe('#9e9e9e');
    });

    it('falls back to the hex when a token cannot be read off a theme', () => {
        //No element, so `--amber-color` resolves to nothing: the caller's hex is the answer, never an empty string.
        expect(resolveUiColor(noEl, 'amber', '#9e9e9e', 'grey')).toBe('#9e9e9e');
    });

    it('never returns a var() name, whatever it is handed', () => {
        //The exact defect: a hex wrapped into `var(--#ff0000-color)`. Nothing paintable ever looks like that.
        for (const token of ['#ff0000', 'rgb(0,0,0)', 'amber', '', undefined]) {
            expect(resolveUiColor(noEl, token, '#9e9e9e', 'grey')).not.toContain('var(');
            expect(resolveUiColor(noEl, token, '#9e9e9e', 'grey')).not.toContain('--');
        }
    });
});
