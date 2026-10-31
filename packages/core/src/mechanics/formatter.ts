/**
 * Formats mathematical polynomial expressions for structural mechanics reporting.
 */

export interface PolynomialTerm {
  power: number;
  coeff: number;
}

/**
 * Rounds a number to a specified number of decimal digits, eliminating floating point noise.
 */
export function cleanNumber(num: number, maxDecimals: number = 3): number {
  if (Math.abs(num) < 1e-12) return 0;
  const factor = 10 ** maxDecimals;
  return Math.round(num * factor) / factor;
}

/**
 * Formats a single number into a readable string without trailing zeros.
 */
export function formatNum(num: number, maxDecimals: number = 3): string {
  const cleaned = cleanNumber(num, maxDecimals);
  if (cleaned === 0) return '0';
  // If it is an integer, return without decimal point
  if (Number.isInteger(cleaned)) return cleaned.toString();
  return cleaned.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

/**
 * Formats an array of polynomial coefficients [a0, a1, a2, ...] representing:
 *   P(var) = a0 + a1*var + a2*var^2 + ... + an*var^n
 * into an algebraic string in ascending or descending order.
 */
export function formatPolynomial(
  coeffs: readonly number[],
  varName: string = 'x',
  options: {
    order?: 'ascending' | 'descending';
    maxDecimals?: number;
    factorPrefix?: string; // e.g. "1/EI * "
  } = {}
): string {
  const { order = 'descending', maxDecimals = 3, factorPrefix = '' } = options;
  const eps = 1e-10;

  const nonZeroTerms: PolynomialTerm[] = [];
  for (let power = 0; power < coeffs.length; power++) {
    const coeff = coeffs[power] ?? 0;
    if (Math.abs(coeff) > eps) {
      nonZeroTerms.push({ power, coeff });
    }
  }

  if (nonZeroTerms.length === 0) {
    return '0';
  }

  if (order === 'descending') {
    nonZeroTerms.sort((a, b) => b.power - a.power);
  } else {
    nonZeroTerms.sort((a, b) => a.power - b.power);
  }

  let expr = '';

  for (let i = 0; i < nonZeroTerms.length; i++) {
    const { power, coeff } = nonZeroTerms[i]!;
    const isFirst = i === 0;
    const absCoeff = Math.abs(coeff);
    const sign = coeff < 0 ? '-' : '+';

    let coeffStr = formatNum(absCoeff, maxDecimals);

    // Variable part
    let varStr = '';
    if (power === 0) {
      varStr = '';
    } else if (power === 1) {
      varStr = varName;
    } else {
      varStr = `${varName}^${power}`;
    }

    // Combine coefficient and variable
    let termStr = '';
    if (power === 0) {
      termStr = coeffStr;
    } else if (Math.abs(absCoeff - 1.0) < eps) {
      termStr = varStr;
    } else {
      termStr = `${coeffStr}·${varStr}`;
    }

    if (isFirst) {
      expr += coeff < 0 ? `-${termStr}` : termStr;
    } else {
      expr += ` ${sign} ${termStr}`;
    }
  }

  if (factorPrefix) {
    if (nonZeroTerms.length > 1) {
      return `${factorPrefix}(${expr})`;
    }
    return `${factorPrefix}${expr}`;
  }

  return expr;
}

