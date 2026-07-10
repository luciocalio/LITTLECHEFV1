import {
  calcIngredientCost,
  calcPreparationCost,
  calcPreparationInDish,
  calcDishFoodCost,
  calcMargin,
  calcAvgFoodCostPct,
  convertPrice,
  getUnitCategory,
  safeNum,
} from './calcEngine';

describe('calcEngine', () => {
  // ─────────────────────────────────────────────────────────
  // UNIT CATEGORY TESTS
  // ─────────────────────────────────────────────────────────
  describe('getUnitCategory', () => {
    it('should identify weight units', () => {
      expect(getUnitCategory('kg')).toBe('weight');
      expect(getUnitCategory('g')).toBe('weight');
      expect(getUnitCategory('etto')).toBe('weight');
      expect(getUnitCategory('mg')).toBe('weight');
    });

    it('should identify volume units', () => {
      expect(getUnitCategory('L')).toBe('volume');
      expect(getUnitCategory('ml')).toBe('volume');
      expect(getUnitCategory('cl')).toBe('volume');
      expect(getUnitCategory('cucchiaio')).toBe('volume');
    });

    it('should identify count units', () => {
      expect(getUnitCategory('pz')).toBe('count');
      expect(getUnitCategory('fetta')).toBe('count');
      expect(getUnitCategory('porzione')).toBe('count');
    });

    it('should return null for unknown units', () => {
      expect(getUnitCategory('xyz')).toBe(null);
      expect(getUnitCategory('unknown')).toBe(null);
    });
  });

  // ─────────────────────────────────────────────────────────
  // INGREDIENT COST TESTS (calcIngredientCost)
  // ─────────────────────────────────────────────────────────
  describe('calcIngredientCost', () => {
    it('should calculate cost for pasta: €1.20/kg, 120g used', () => {
      const pasta = { id: 1, name: 'Pasta', unit: 'kg', price: 1.20 };
      const cost = calcIngredientCost(pasta, 120, 'g');
      expect(cost).toBeCloseTo(0.144, 3);
    });

    it('should calculate cost for oil: €8.00/L, 30ml used', () => {
      const olio = { id: 2, name: 'Olio', unit: 'L', price: 8.00 };
      const cost = calcIngredientCost(olio, 30, 'ml');
      expect(cost).toBeCloseTo(0.240, 3);
    });

    it('should calculate cost for eggs: €0.25/pz, 3pz used', () => {
      const uova = { id: 3, name: 'Uova', unit: 'pz', price: 0.25 };
      const cost = calcIngredientCost(uova, 3, 'pz');
      expect(cost).toBeCloseTo(0.75, 2);
    });

    it('should calculate cost with price_per_unit field', () => {
      const ricci = { id: 4, name: 'Ricci', unit: 'pz', price_per_unit: 2.50 };
      const cost = calcIngredientCost(ricci, 5, 'pz');
      expect(cost).toBeCloseTo(12.50, 2);
    });

    it('should handle unit conversion: 0.5 kg to grams', () => {
      const ingredient = { id: 5, name: 'Flour', unit: 'kg', price: 1.00 };
      const cost = calcIngredientCost(ingredient, 500, 'g');
      expect(cost).toBeCloseTo(0.5, 2);
    });

    it('should handle aglio: €2.00/kg, 10g used', () => {
      const aglio = { id: 6, name: 'Aglio', unit: 'kg', price: 2.00 };
      const cost = calcIngredientCost(aglio, 10, 'g');
      expect(cost).toBeCloseTo(0.020, 3);
    });

    it('should return 0 if ingredient is null', () => {
      expect(calcIngredientCost(null, 100, 'g')).toBe(0);
    });

    it('should return 0 if price is 0 or negative', () => {
      const ingredient = { id: 7, name: 'Test', unit: 'g', price: 0 };
      expect(calcIngredientCost(ingredient, 100, 'g')).toBe(0);
    });

    it('should return 0 if quantity is 0 or negative', () => {
      const ingredient = { id: 8, name: 'Test', unit: 'g', price: 1.00 };
      expect(calcIngredientCost(ingredient, 0, 'g')).toBe(0);
      expect(calcIngredientCost(ingredient, -10, 'g')).toBe(0);
    });

    it('should return 0 if unit is missing', () => {
      const ingredient = { id: 9, name: 'Test', unit: null, price: 1.00 };
      expect(calcIngredientCost(ingredient, 100, 'g')).toBe(0);
    });

    it('should warn on incompatible unit categories', () => {
      const ingredient = { id: 10, name: 'Test', unit: 'kg', price: 1.00 };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const cost = calcIngredientCost(ingredient, 100, 'ml');
      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should guard against NaN', () => {
      const ingredient = { id: 11, name: 'Test', unit: 'g', price: 'invalid' };
      const cost = calcIngredientCost(ingredient, 100, 'g');
      expect(isNaN(cost)).toBe(false);
      expect(cost).toBe(0);
    });

    it('should guard against Infinity', () => {
      const ingredient = { id: 12, name: 'Test', unit: 'g', price: Infinity };
      const cost = calcIngredientCost(ingredient, 100, 'g');
      expect(isFinite(cost)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PREPARATION COST IN DISH (calcPreparationInDish)
  // ─────────────────────────────────────────────────────────
  describe('calcPreparationInDish', () => {
    it('should calculate proportional cost: 50g of 500g prep with €10 cost', () => {
      const prep = { id: 1, name: 'Stock', total_cost: 10.00, total_yield: 500, yield_unit: 'g' };
      const cost = calcPreparationInDish(prep, 50, 'g');
      expect(cost).toBeCloseTo(1.0, 2);
    });

    it('should calculate for different unit: 250ml of 1L prep', () => {
      const prep = { id: 2, name: 'Sauce', total_cost: 5.00, total_yield: 1, yield_unit: 'L' };
      const cost = calcPreparationInDish(prep, 250, 'ml');
      expect(cost).toBeCloseTo(1.25, 2);
    });

    it('should return 0 if preparation is null', () => {
      expect(calcPreparationInDish(null, 100, 'g')).toBe(0);
    });

    it('should return 0 if quantity is 0 or negative', () => {
      const prep = { id: 3, name: 'Test', total_cost: 10, total_yield: 500, yield_unit: 'g' };
      expect(calcPreparationInDish(prep, 0, 'g')).toBe(0);
      expect(calcPreparationInDish(prep, -50, 'g')).toBe(0);
    });

    it('should fallback to total cost if yield is missing or zero', () => {
      const prep = { id: 4, name: 'Test', total_cost: 10.00, total_yield: null, yield_unit: 'g' };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const cost = calcPreparationInDish(prep, 100, 'g');
      expect(cost).toBeCloseTo(10.0, 2);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw on incompatible unit categories', () => {
      const prep = { id: 5, name: 'Test', total_cost: 10, total_yield: 500, yield_unit: 'g' };
      expect(() => calcPreparationInDish(prep, 100, 'ml')).toThrow();
    });

    it('should use yield_unit or fallback to unit', () => {
      const prep = { id: 6, name: 'Test', total_cost: 5, total_yield: 1000, unit: 'ml' };
      const cost = calcPreparationInDish(prep, 500, 'ml');
      expect(cost).toBeCloseTo(2.5, 2);
    });

    it('should handle NaN total_yield gracefully', () => {
      const prep = { id: 7, name: 'Test', total_cost: 10, total_yield: NaN, yield_unit: 'g' };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const cost = calcPreparationInDish(prep, 100, 'g');
      expect(isNaN(cost)).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // DISH FOOD COST (calcDishFoodCost)
  // ─────────────────────────────────────────────────────────
  describe('calcDishFoodCost', () => {
    const mockIngredients = [
      { id: 'pasta1', name: 'Pasta', unit: 'kg', price: 1.20 },
      { id: 'olio1', name: 'Olio', unit: 'L', price: 8.00 },
      { id: 'uova1', name: 'Uova', unit: 'pz', price: 0.25 },
    ];

    const mockPreps = [
      { id: 'prep1', name: 'Stock', total_cost: 10.00, total_yield: 1000, yield_unit: 'ml' },
    ];

    it('should sum ingredient costs in a dish', () => {
      const components = [
        { type: 'ingredient', id_ref: 'pasta1', quantity: 120, unit: 'g' },
        { type: 'ingredient', id_ref: 'olio1', quantity: 30, unit: 'ml' },
      ];
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBeCloseTo(0.384, 2);
    });

    it('should include preparation costs', () => {
      const components = [
        { type: 'ingredient', id_ref: 'pasta1', quantity: 120, unit: 'g' },
        { type: 'preparation', id_ref: 'prep1', quantity: 100, unit: 'ml' },
      ];
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBeCloseTo(1.144, 2);
    });

    it('should handle empty components array', () => {
      const cost = calcDishFoodCost([], mockIngredients, mockPreps);
      expect(cost).toBe(0);
    });

    it('should handle null components', () => {
      const cost = calcDishFoodCost(null, mockIngredients, mockPreps);
      expect(cost).toBe(0);
    });

    it('should skip components with qty <= 0', () => {
      const components = [
        { type: 'ingredient', id_ref: 'pasta1', quantity: 0, unit: 'g' },
        { type: 'ingredient', id_ref: 'olio1', quantity: -10, unit: 'ml' },
      ];
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBe(0);
    });

    it('should warn on missing ingredient', () => {
      const components = [
        { type: 'ingredient', id_ref: 'invalid', quantity: 100, unit: 'g' },
      ];
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle legacy id field (not id_ref)', () => {
      const components = [
        { type: 'ingredient', id: 'pasta1', quantity: 120, unit: 'g' },
      ];
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBeCloseTo(0.144, 3);
    });

    it('should handle qty alias for quantity', () => {
      const components = [
        { type: 'ingredient', id_ref: 'pasta1', qty: 120, unit: 'g' },
      ];
      const cost = calcDishFoodCost(components, mockIngredients, mockPreps);
      expect(cost).toBeCloseTo(0.144, 3);
    });

    it('should catch errors in preparation cost calc and continue', () => {
      const badPreps = [
        { id: 'bad', name: 'Bad', total_cost: 10, total_yield: 500, yield_unit: 'g' },
      ];
      const components = [
        { type: 'preparation', id_ref: 'bad', quantity: 100, unit: 'ml' }, // incompatible unit
      ];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const cost = calcDishFoodCost(components, mockIngredients, badPreps);
      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────
  // MARGIN CALCULATION (calcMargin)
  // ─────────────────────────────────────────────────────────
  describe('calcMargin', () => {
    it('should calculate margin for price €10, cost €3', () => {
      const { marginEuro, marginPct, status } = calcMargin(10, 3);
      expect(marginEuro).toBeCloseTo(7, 1);
      expect(marginPct).toBeCloseTo(70, 1);
      expect(status).toBe('top');
    });

    it('should mark status as "top" for >50% margin', () => {
      const { status } = calcMargin(10, 4);
      expect(status).toBe('top');
    });

    it('should mark status as "media" for 30-50% margin', () => {
      const { status } = calcMargin(10, 5);
      expect(status).toBe('media');
    });

    it('should mark status as "risk" for <30% margin', () => {
      const { status } = calcMargin(10, 8);
      expect(status).toBe('risk');
    });

    it('should return 0 margin if price <= 0', () => {
      const { marginEuro, marginPct, status } = calcMargin(0, 5);
      expect(marginEuro).toBe(0);
      expect(marginPct).toBe(0);
      expect(status).toBe('risk');
    });

    it('should handle negative cost', () => {
      const { marginEuro } = calcMargin(10, -2);
      expect(marginEuro).toBeCloseTo(12, 1);
    });

    it('should parse string prices', () => {
      const { marginEuro } = calcMargin('10', '3');
      expect(marginEuro).toBeCloseTo(7, 1);
    });

    it('should handle NaN', () => {
      const { marginEuro, marginPct } = calcMargin('invalid', 'invalid');
      expect(isNaN(marginEuro)).toBe(false);
      expect(isNaN(marginPct)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PRICE CONVERSION (convertPrice)
  // ─────────────────────────────────────────────────────────
  describe('convertPrice', () => {
    it('should convert €9/L to €/ml', () => {
      const converted = convertPrice(9, 'L', 'ml');
      expect(converted).toBeCloseTo(0.009, 3);
    });

    it('should convert €1.20/kg to €/g', () => {
      const converted = convertPrice(1.20, 'kg', 'g');
      expect(converted).toBeCloseTo(0.0012, 4);
    });

    it('should handle same unit', () => {
      const converted = convertPrice(10, 'g', 'g');
      expect(converted).toBeCloseTo(10, 2);
    });

    it('should return fallback if unit unknown', () => {
      const converted = convertPrice(10, 'invalid', 'g');
      expect(converted).toBeCloseTo(10, 2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // AGGREGATE STATS (calcAvgFoodCostPct)
  // ─────────────────────────────────────────────────────────
  describe('calcAvgFoodCostPct', () => {
    it('should calculate average food cost % across dishes', () => {
      const dishes = [
        { price: 10, food_cost: 3 },
        { price: 20, food_cost: 6 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(avg).toBeCloseTo(30, 1);
    });

    it('should filter out dishes with price <= 0', () => {
      const dishes = [
        { price: 10, food_cost: 3 },
        { price: 0, food_cost: 5 },
        { price: 20, food_cost: 6 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(avg).toBeCloseTo(30, 1);
    });

    it('should return 0 for empty list', () => {
      const avg = calcAvgFoodCostPct([]);
      expect(avg).toBe(0);
    });

    it('should handle foodCost alias', () => {
      const dishes = [
        { price: 10, foodCost: 3 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(avg).toBeCloseTo(30, 1);
    });

    it('should handle selling_price alias', () => {
      const dishes = [
        { selling_price: 10, food_cost: 3 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(avg).toBeCloseTo(30, 1);
    });

    it('should guard against NaN percentages', () => {
      const dishes = [
        { price: 10, food_cost: 'invalid' },
        { price: 20, food_cost: 6 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(isNaN(avg)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // HELPERS (safeNum)
  // ─────────────────────────────────────────────────────────
  describe('safeNum', () => {
    it('should parse valid numbers', () => {
      expect(safeNum('42')).toBe(42);
      expect(safeNum(3.14)).toBe(3.14);
      expect(safeNum('100.5')).toBe(100.5);
    });

    it('should return fallback for NaN', () => {
      expect(safeNum('invalid')).toBe(0);
      expect(safeNum('invalid', 99)).toBe(99);
    });

    it('should return fallback for Infinity', () => {
      expect(safeNum(Infinity)).toBe(0);
      expect(safeNum(Infinity, -1)).toBe(-1);
    });

    it('should return fallback for -Infinity', () => {
      expect(safeNum(-Infinity)).toBe(0);
    });

    it('should handle null and undefined', () => {
      expect(safeNum(null)).toBe(0);
      expect(safeNum(undefined)).toBe(0);
      expect(safeNum(null, 42)).toBe(42);
    });
  });

  // ─────────────────────────────────────────────────────────
  // EDGE CASES AND INTEGRATION
  // ─────────────────────────────────────────────────────────
  describe('Integration tests', () => {
    it('should calculate complete dish with ingredients and preps', () => {
      const ingredients = [
        { id: 'pasta', unit: 'kg', price: 1.20 },
        { id: 'sauce', unit: 'L', price: 5.00 },
      ];
      const preps = [
        { id: 'prep1', total_cost: 20, total_yield: 1000, yield_unit: 'g' },
      ];
      const components = [
        { type: 'ingredient', id_ref: 'pasta', quantity: 100, unit: 'g' },
        { type: 'ingredient', id_ref: 'sauce', quantity: 50, unit: 'ml' },
        { type: 'preparation', id_ref: 'prep1', quantity: 200, unit: 'g' },
      ];
      const cost = calcDishFoodCost(components, ingredients, preps);
      expect(cost).toBeGreaterThan(0);
      expect(isNaN(cost)).toBe(false);
      expect(isFinite(cost)).toBe(true);
    });

    it('should preserve rounding in cost calculations', () => {
      const pasta = { unit: 'g', price: 0.001 };
      const cost = calcIngredientCost(pasta, 333, 'g');
      expect(cost).toBeCloseTo(0.333, 3);
    });

    it('should maintain precision with small values', () => {
      const ingredient = { unit: 'kg', price: 0.001 };
      const cost = calcIngredientCost(ingredient, 1, 'g');
      // Rounding to 4 decimals: (1/1000) * 0.001 = 0.000001 → rounds to 0
      expect(cost).toBe(0);
    });

    it('should not produce Infinity or NaN in typical workflows', () => {
      const dishes = [
        { name: 'Piatto 1', selling_price: 15, food_cost: 4.5 },
        { name: 'Piatto 2', selling_price: 12, food_cost: 3.6 },
        { name: 'Piatto 3', selling_price: 20, food_cost: 5.0 },
      ];
      const avg = calcAvgFoodCostPct(dishes);
      expect(isNaN(avg)).toBe(false);
      expect(isFinite(avg)).toBe(true);
      expect(avg).toBeGreaterThan(0);
    });
  });
});
