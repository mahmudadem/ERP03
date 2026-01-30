
/**
 * Safe Math Expression Evaluator
 * 
 * safely evaluates simple mathematical expressions (e.g., "10+5", "100*1.15").
 * returns null if the expression is invalid or cannot be evaluated.
 */
export const evaluateMathExpression = (expression: string): number | null => {
  if (!expression) return null;
  
  // Normalize commas to dots (e.g. "10,5" -> "10.5")
  const normalized = expression.replace(/,/g, '.');
  
  // Strict regex to prevent code injection
  // Only allow digits, dots, +, -, *, /, (, ), and spaces
  // This blocks letters like "alert('x')"
  if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(normalized)) {
    return null;
  }

  try {
    // Check if it's safe to evaluate
    // eslint-disable-next-line
    const result = new Function(`return (${normalized})`)();
    
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result; // Return raw number, let caller handle rounding
    }
  } catch (err) {
    console.warn('Failed to evaluate math expression:', normalized, err);
  }
  
  return null;
};

/**
 * Rounds a number to a specific number of decimal places.
 */
export function roundMoney(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
