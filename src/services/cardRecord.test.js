import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardPriceLabel,
  cardRecordFromResult,
  normalizeCardRecord,
  stampCardPrice,
  applyCardPricePatch,
  cardPriceNeedsRefresh,
  withCardRecord,
} from './cardRecord.js';

describe('one exact card record', () => {
  test('normalizes Pokemon, Magic, and Yu-Gi-Oh catalogue rows', () => {
    const pokemon = normalizeCardRecord({
      id: 'xy6-104', name: 'Rayquaza-EX', game: 'pokemon', setName: 'Roaring Skies',
      setId: 'xy6', number: '104', rarity: 'Rare Ultra', form: 'holo', price: 239.55,
      priceSource: 'TCGplayer', imageUrl: 'https://img/pokemon',
    });
    const mtg = normalizeCardRecord({
      id: 'mtg-13', name: 'Optimus Prime, Hero', game: 'mtg', setName: 'Transformers',
      setId: 'bot', number: '13', rarity: 'mythic', form: 'normal', price: 14.7,
      priceSource: 'Scryfall', imageUrl: 'https://img/mtg',
    });
    const ygo = normalizeCardRecord({
      id: '45141013', printingId: 'tcgplayer:592579', name: 'Heat Wave', game: 'yugioh',
      setName: 'Quarter Century Bonanza', number: 'RA03-EN058', rarity: 'Quarter Century Secret Rare',
      price: 14.37, priceSource: 'TCGplayer', imageUrl: 'https://img/ygo',
    });
    for (const card of [pokemon, mtg, ygo]) {
      assert.equal(card.pinned, true);
      assert.ok(card.printingId);
      assert.ok(card.setName);
      assert.ok(card.number);
      assert.ok(card.rarity);
      assert.ok(card.imageUrl);
      assert.ok(card.price);
      assert.ok(card.priceSource);
    }
  });

  test('a single known finish is filled without guessing between choices', () => {
    const one = normalizeCardRecord({
      id: 'one', name: 'One Finish', game: 'pokemon', availableFinishes: ['holo'],
    });
    const two = normalizeCardRecord({
      id: 'two', name: 'Two Finishes', game: 'pokemon', availableFinishes: ['normal', 'reverse'],
    });
    assert.equal(one.form, 'holo');
    assert.equal(one.finish, 'Holo');
    assert.equal(two.form, null);
  });

  test('a report, pin, and printing become one record', () => {
    const card = cardRecordFromResult({
      card_name: 'Rayquaza-EX', game: 'pokemon',
      _pin: { id: 'xy6-104', game: 'pokemon', setName: 'Roaring Skies', number: '104', form: 'holo', price: 200 },
      printing: { game: 'pokemon', printingId: 'xy6-104', rarity: 'Rare Ultra' },
      prices: { en_price: '$239.55', price_source: 'TCGplayer', price_checked_at: '2026-09-06T20:00:00.000Z' },
    });
    assert.equal(card.printingId, 'xy6-104');
    assert.equal(card.price, 239.55);
    assert.equal(card.priceSource, 'TCGplayer');
    assert.equal(card.rarity, 'Rare Ultra');
  });

  test('attaching the record removes the retired 30-day field', () => {
    const result = withCardRecord({
      card_name: 'Heat Wave', game: 'yugioh',
      prices: { en_price: '$14.37', trend_30d: 'up', signal_vs_market: 'agree' },
    }, {
      id: '45141013', printingId: 'tcgplayer:592579', name: 'Heat Wave', game: 'yugioh',
      setName: 'Quarter Century Bonanza', number: 'RA03-EN058', rarity: 'Quarter Century Secret Rare',
      price: 14.37, priceSource: 'TCGplayer',
    });
    assert.equal(result.card, result._pin);
    assert.equal(result.card, result.printing);
    assert.equal('trend_30d' in result.prices, false);
  });

  test('price labels and timestamps are exact and stable', () => {
    const card = stampCardPrice({
      id: 'card-1', name: 'Test', game: 'mtg', form: 'normal', price: 12.5,
    }, Date.UTC(2026, 8, 6, 20));
    assert.equal(cardPriceLabel(card), '$12.50');
    assert.equal(card.priceCheckedAt, '2026-09-06T20:00:00.000Z');
  });

  test('one exact price patch updates every saved-card surface', () => {
    const card = normalizeCardRecord({
      id: 'card-1', name: 'Test', game: 'mtg', form: 'foil', price: 8,
      priceSource: 'Scryfall', priceCheckedAt: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(cardPriceNeedsRefresh(card, Date.parse('2026-09-06T00:00:00.000Z')), true);
    const fresh = applyCardPricePatch(card, {
      en_price: '$9.25', price_source: 'Scryfall', price_checked_at: '2026-09-06T00:00:00.000Z',
    });
    assert.equal(fresh.price, 9.25);
    assert.equal(fresh.marketPrices.foil, 9.25);
    assert.equal(fresh.priceSource, 'Scryfall');
    assert.equal(cardPriceNeedsRefresh(fresh, Date.parse('2026-09-06T01:00:00.000Z')), false);
  });

  test('a newer saved-card price replaces an older cached report price', () => {
    const oldResult = {
      card_name: 'Test', game: 'mtg',
      prices: { en_price: '$8.00', price_source: 'Scryfall', price_checked_at: '2026-09-05T00:00:00.000Z' },
    };
    const current = {
      id: 'card-1', printingId: 'card-1', name: 'Test', game: 'mtg', setName: 'Set', number: '1',
      form: 'foil', price: 9.25, priceSource: 'Scryfall', priceCheckedAt: '2026-09-06T00:00:00.000Z',
    };
    const merged = withCardRecord(oldResult, current);
    assert.equal(merged.card.price, 9.25);
    assert.equal(merged.prices.en_price, '$9.25');
  });

  test('a fresh exact-price miss clears an older saved number and source', () => {
    const result = withCardRecord({
      card_name: 'Test', game: 'mtg',
      prices: { en_price: '', price_source: '', price_checked_at: '2026-09-07T00:00:00.000Z' },
    }, {
      id: 'card-1', printingId: 'card-1', name: 'Test', game: 'mtg', setName: 'Set', number: '1',
      form: 'foil', price: 9.25, marketPrices: { foil: 9.25 }, priceSource: 'Scryfall',
      priceCheckedAt: '2026-09-06T00:00:00.000Z',
    });
    assert.equal(result.card.price, null);
    assert.equal(result.card.marketPrices.foil, null);
    assert.equal(result.card.priceSource, null);
    assert.equal(result.prices.en_price, '');
  });
});
