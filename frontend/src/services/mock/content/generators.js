/**
 * Parametric question generators (mock content engine).
 * Every question carries a computed correct answer, a step-by-step explanation (mandatory, F4-02)
 * and a concept note, authored in LaTeX-in-text ($...$) as required by F3-07.
 * Real content will come from the admin-managed question bank; these only exist for the demo.
 */
const KEYS = ['A', 'B', 'C', 'D'];
const LEVEL = { EASY: 1, MEDIUM: 2, HARD: 3 };

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const p = (n) => (n < 0 ? `(${n})` : `${n}`);
const signed = (n) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);

function frac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  const nn = n / g;
  const dd = d / g;
  if (dd === 1) return `${nn}`;
  return nn < 0 ? `-\\frac{${-nn}}{${dd}}` : `\\frac{${nn}}{${dd}}`;
}

/** linear expression "ax + b" in LaTeX */
function lin(a, b, v = 'x') {
  let s = '';
  if (a === 1) s = v;
  else if (a === -1) s = `-${v}`;
  else if (a !== 0) s = `${a}${v}`;
  if (b !== 0) s = s ? `${s} ${signed(b)}` : `${b}`;
  return s || '0';
}

function mcq(r, correct, candidates, fallbackNum) {
  const pool = [...new Set(candidates.filter((c) => c !== correct && c != null && c !== ''))];
  let k = 1;
  while (pool.length < 3) {
    const extra = fallbackNum != null ? `${fallbackNum + k * (k % 2 ? 1 : -1)}` : `${k * 7}`;
    if (extra !== correct && !pool.includes(extra)) pool.push(extra);
    k += 1;
  }
  const all = r.shuffle([correct, ...pool.slice(0, 3)]);
  return {
    type: 'MCQ_SINGLE',
    options: all.map((text, i) => ({ key: KEYS[i], text: text.startsWith('$') || /[a-z]/i.test(text) ? text : `$${text}$` })),
    correctAnswer: KEYS[all.indexOf(correct)],
  };
}
const numeric = (answer, tolerance = 0) => ({ type: 'NUMERIC', correctAnswer: String(answer), answerTolerance: tolerance });

const G = {
  integers(r, L) {
    const a = r.nz(-8 * L - 4, 8 * L + 4);
    const b = r.nz(-8 * L - 4, 8 * L + 4);
    const op = L === 1 ? r.pick(['+', '-']) : r.pick(['+', '-', '\\times']);
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const steps = op === '\\times'
      ? [`Multiply the absolute values: $${Math.abs(a)} \\times ${Math.abs(b)} = ${Math.abs(a * b)}$.`,
        `Signs: ${(a < 0) === (b < 0) ? 'same signs give a positive result' : 'different signs give a negative result'}.`,
        `So $${p(a)} \\times ${p(b)} = ${ans}$.`]
      : op === '-'
        ? [`Subtracting a number is the same as adding its opposite: $${p(a)} - ${p(b)} = ${p(a)} + ${p(-b)}$.`, `Now add: $${a} + ${p(-b)} = ${ans}$.`]
        : [`Start at $${a}$ on the number line.`, `Move ${Math.abs(b)} step${Math.abs(b) > 1 ? 's' : ''} to the ${b > 0 ? 'right' : 'left'} to reach $${ans}$.`];
    return { text: `Find the value of $${p(a)} ${op} ${p(b)}$.`, ...numeric(ans), explanation: steps,
      conceptNote: 'On a number line, adding a positive number moves right and adding a negative number moves left. Subtracting a number means adding its additive inverse. When multiplying, like signs give a positive product and unlike signs give a negative product.' };
  },

  fractions(r, L) {
    const b = r.int(2, 5 + 2 * L);
    let d = r.int(2, 5 + 2 * L);
    if (d === b) d += 1;
    const a = r.int(1, b - 1);
    const c = r.int(1, d - 1);
    if (L === 3) {
      const ans = frac(a * c, b * d);
      return { text: `Find $\\frac{${a}}{${b}} \\times \\frac{${c}}{${d}}$ in its simplest form.`,
        ...mcq(r, `$${ans}$`, [`$${frac(a * d, b * c)}$`, `$${frac(a + c, b + d)}$`, `$${frac(a * c + 1, b * d)}$`]),
        explanation: [`Multiply the numerators: $${a} \\times ${c} = ${a * c}$.`, `Multiply the denominators: $${b} \\times ${d} = ${b * d}$.`, `Simplify $\\frac{${a * c}}{${b * d}} = ${ans}$.`],
        conceptNote: 'To multiply fractions, multiply numerator by numerator and denominator by denominator, then simplify by dividing both by their HCF.' };
    }
    const lcm = (b * d) / gcd(b, d);
    const num = a * (lcm / b) + c * (lcm / d);
    const ans = frac(num, lcm);
    return { text: `Add: $\\frac{${a}}{${b}} + \\frac{${c}}{${d}}$`,
      ...mcq(r, `$${ans}$`, [`$${frac(a + c, b + d)}$`, `$${frac(a + c, lcm)}$`, `$${frac(num + 1, lcm)}$`]),
      explanation: [`The LCM of ${b} and ${d} is ${lcm}.`,
        `Rewrite: $\\frac{${a}}{${b}} = \\frac{${a * (lcm / b)}}{${lcm}}$ and $\\frac{${c}}{${d}} = \\frac{${c * (lcm / d)}}{${lcm}}$.`,
        `Add the numerators: $\\frac{${num}}{${lcm}} = ${ans}$.`],
      conceptNote: 'Fractions can only be added when they have the same denominator. Convert both to equivalent fractions over the LCM of the denominators, then add the numerators. Never add the denominators.' };
  },

  decimals(r, L) {
    const x = r.int(11, 99) / 10;
    const y = L === 1 ? r.int(2, 9) : r.int(11, 49) / 10;
    const ans = round(x * y, 3);
    return { text: `Calculate $${x} \\times ${y}$.`, ...numeric(ans, 0.001),
      explanation: [`Ignore the decimal points: $${Math.round(x * 10)} \\times ${Math.round(y * (L === 1 ? 1 : 10))} = ${Math.round(x * 10) * Math.round(y * (L === 1 ? 1 : 10))}$.`,
        `Count decimal places: ${L === 1 ? '1' : '1 + 1 = 2'}.`, `Place the decimal point: $${ans}$.`],
      conceptNote: 'Multiply decimals as whole numbers, then place the decimal point so the answer has as many decimal places as both factors together.' };
  },

  numbers(r, L) {
    const pairs = [[2, 3], [3, 4], [3, 5], [4, 5], [2, 5], [5, 7], [4, 7], [3, 8]];
    const [pp, q] = r.pick(pairs);
    const h = r.int(2, 4 + 3 * L);
    const a = h * pp;
    const b = h * q;
    if (L === 3) {
      const l = h * pp * q;
      return { text: `Find the LCM of ${a} and ${b}.`, ...numeric(l),
        explanation: [`HCF of ${a} and ${b} is ${h}.`, `Use $\\text{LCM} = \\frac{a \\times b}{\\text{HCF}} = \\frac{${a} \\times ${b}}{${h}}$.`, `$\\text{LCM} = ${l}$.`],
        conceptNote: 'For any two numbers, HCF × LCM = product of the numbers. The LCM is the smallest number that both numbers divide exactly.' };
    }
    return { text: `Find the HCF of ${a} and ${b}.`, ...numeric(h),
      explanation: [`Factorise: $${a} = ${h} \\times ${pp}$ and $${b} = ${h} \\times ${q}$.`, `${pp} and ${q} share no common factor other than 1.`, `So the HCF is ${h}.`],
      conceptNote: 'The HCF (highest common factor) is the largest number that divides both numbers exactly. Prime factorisation makes the common factors easy to see.' };
  },

  linear(r, L) {
    const x = r.int(-3 - L, 4 + 2 * L);
    const a = r.nz(2, 4 + 2 * L);
    const c = L === 1 ? 0 : r.pick([1, 2, 3, -1, -2].filter((v) => v !== a));
    const b = r.nz(-9, 12);
    const d = a * x + b - c * x;
    const left = lin(a, b);
    const right = lin(c, d);
    const steps = c === 0
      ? [`Write the equation: $${left} = ${d}$.`, `Move the constant: $${a}x = ${d} ${signed(-b)} = ${d - b}$.`, `Divide by ${a}: $x = ${x}$.`]
      : [`Write the equation: $${left} = ${right}$.`, `Move the $x$ terms to the left (change sign): $${a}x ${signed(-c)}x = ${d} ${signed(-b)}$.`,
        `Simplify: $${a - c}x = ${d - b}$.`, `Divide by ${a - c}: $x = ${x}$.`, `Check: LHS $= ${a * x + b}$, RHS $= ${c * x + d}$ ✓`];
    return { text: `Solve for $x$: $${left} = ${right}$`, ...numeric(x), explanation: steps,
      conceptNote: 'A linear equation stays balanced when you do the same thing to both sides. When a term moves across the "=" sign its sign changes. Collect variable terms on one side and constants on the other, then divide by the coefficient.' };
  },

  ratio(r, L) {
    if (L < 3) {
      const n1 = r.int(2, 8);
      const unit = r.int(3, 25) * 5;
      const n2 = r.int(n1 + 1, n1 + 8);
      return { text: `If ${n1} notebooks cost ₹${n1 * unit}, how much will ${n2} notebooks cost (in ₹)?`, ...numeric(n2 * unit),
        explanation: [`Cost of 1 notebook $= \\frac{${n1 * unit}}{${n1}} = ₹${unit}$.`, `Cost of ${n2} notebooks $= ${n2} \\times ${unit} = ₹${n2 * unit}$.`],
        conceptNote: 'In direct proportion, both quantities increase or decrease together, so their ratio stays constant. The unitary method finds the value of one unit first.' };
    }
    const w1 = r.pick([6, 8, 10, 12]);
    const days = r.pick([10, 12, 15, 18]);
    const total = w1 * days;
    const options = [4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30].filter((w) => w !== w1 && total % w === 0);
    const w2 = r.pick(options);
    return { text: `${w1} workers finish a job in ${days} days. How many days will ${w2} workers take (same rate)?`, ...numeric(total / w2),
      explanation: [`Total work $= ${w1} \\times ${days} = ${total}$ worker-days.`, `More workers means fewer days: inverse proportion.`, `Days $= \\frac{${total}}{${w2}} = ${total / w2}$.`],
      conceptNote: 'In inverse proportion, when one quantity increases the other decreases so that their product stays constant.' };
  },

  angles(r, L) {
    if (L === 1) {
      const a = r.int(12, 78);
      const supp = r.next() > 0.5;
      const ans = (supp ? 180 : 90) - a;
      return { text: `Find the ${supp ? 'supplement' : 'complement'} of $${a}^\\circ$ (in degrees).`, ...numeric(ans),
        explanation: [`${supp ? 'Supplementary' : 'Complementary'} angles add up to $${supp ? 180 : 90}^\\circ$.`, `$${supp ? 180 : 90}^\\circ - ${a}^\\circ = ${ans}^\\circ$.`],
        conceptNote: 'Two angles are complementary if they add up to 90° and supplementary if they add up to 180°.' };
    }
    const a = r.int(30, 80);
    const b = r.int(25, 150 - a - 5);
    if (L === 2) {
      return { text: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle (in degrees).`, ...numeric(180 - a - b),
        explanation: ['The angles of a triangle add up to $180^\\circ$.', `Third angle $= 180^\\circ - (${a}^\\circ + ${b}^\\circ) = ${180 - a - b}^\\circ$.`],
        conceptNote: 'Angle sum property: the three interior angles of any triangle always add up to 180°.' };
    }
    return { text: `In a triangle, the two interior opposite angles are $${a}^\\circ$ and $${b}^\\circ$. Find the exterior angle (in degrees).`, ...numeric(a + b),
      explanation: ['Exterior angle property: an exterior angle equals the sum of the two interior opposite angles.', `Exterior angle $= ${a}^\\circ + ${b}^\\circ = ${a + b}^\\circ$.`],
      conceptNote: 'An exterior angle of a triangle equals the sum of its two interior opposite angles, because both it and the third interior angle make 180° with the adjacent angle.' };
  },

  percent(r, L) {
    if (L === 1) {
      const pc = r.pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 75]);
      const n = r.int(2, 30) * 20;
      return { text: `Find $${pc}\\%$ of ${n}.`, ...numeric((pc * n) / 100),
        explanation: [`$${pc}\\% = \\frac{${pc}}{100}$.`, `$\\frac{${pc}}{100} \\times ${n} = ${(pc * n) / 100}$.`],
        conceptNote: 'Per cent means "per hundred". To find x% of a number, multiply the number by x/100.' };
    }
    if (L === 2) {
      const mp = r.int(4, 40) * 50;
      const disc = r.pick([10, 15, 20, 25, 30]);
      const sp = mp - (mp * disc) / 100;
      return { text: `A bag is marked at ₹${mp}. A discount of $${disc}\\%$ is given. Find the selling price (in ₹).`, ...numeric(sp),
        explanation: [`Discount $= ${disc}\\%$ of ${mp} $= ₹${(mp * disc) / 100}$.`, `Selling price $= ${mp} - ${(mp * disc) / 100} = ₹${sp}$.`],
        conceptNote: 'Discount is always calculated on the marked price. Selling price = marked price − discount.' };
    }
    const P = r.int(4, 40) * 500;
    const R = r.pick([4, 5, 6, 8, 10, 12]);
    const T = r.int(2, 5);
    return { text: `Find the simple interest on ₹${P} at $${R}\\%$ per annum for ${T} years (in ₹).`, ...numeric((P * R * T) / 100),
      explanation: ['Use $SI = \\frac{P \\times R \\times T}{100}$.', `$SI = \\frac{${P} \\times ${R} \\times ${T}}{100}$.`, `$SI = ₹${(P * R * T) / 100}$.`],
      conceptNote: 'Simple interest is charged only on the original principal: SI = P × R × T ÷ 100.' };
  },

  algebra(r, L) {
    if (L === 1) {
      const a = r.int(2, 9); const b = r.int(2, 9); const c = r.int(1, a + b - 1);
      const ans = a + b - c;
      return { text: `Simplify: $${a}x + ${b}x - ${c}x$`, ...mcq(r, `$${ans}x$`, [`$${a + b + c}x$`, `$${ans}x^3$`, `$${ans}$`]),
        explanation: ['All three are like terms (same variable, same power).', `Add the coefficients: $${a} + ${b} - ${c} = ${ans}$.`, `Answer: $${ans}x$.`],
        conceptNote: 'Only like terms can be added or subtracted. Add their numerical coefficients and keep the variable part unchanged.' };
    }
    const a = r.nz(1, 4 + L);
    const b = r.nz(-6, 7);
    if (L === 2) {
      return { text: `Expand: $(x + ${a})^2$`, ...mcq(r, `$x^2 + ${2 * a}x + ${a * a}$`, [`$x^2 + ${a * a}$`, `$x^2 + ${a}x + ${a * a}$`, `$x^2 + ${2 * a}x + ${2 * a}$`]),
        explanation: ['Use the identity $(a + b)^2 = a^2 + 2ab + b^2$.', `Here $a = x$ and $b = ${a}$.`, `$(x + ${a})^2 = x^2 + 2(x)(${a}) + ${a}^2 = x^2 + ${2 * a}x + ${a * a}$.`],
        conceptNote: '(a + b)² is NOT a² + b². The middle term 2ab comes from multiplying (a + b)(a + b) fully.' };
    }
    const sum = a + b; const prod = a * b;
    return { text: `Multiply: $(x + ${a})(x ${signed(b)})$`,
      ...mcq(r, `$${lin(1, 0)}^2 ${sum === 0 ? '' : `${signed(sum)}x `}${signed(prod)}$`.replace('x^2', 'x^2'), [`$x^2 ${signed(prod)}$`, `$x^2 ${signed(sum + 1)}x ${signed(prod)}$`, `$x^2 ${signed(sum)}x ${signed(a + b + 1)}$`]),
      explanation: ['Use $(x + a)(x + b) = x^2 + (a + b)x + ab$.', `$a + b = ${a} + ${p(b)} = ${sum}$ and $ab = ${a} \\times ${p(b)} = ${prod}$.`, `Result: $x^2 ${sum === 0 ? '' : `${signed(sum)}x `}${signed(prod)}$.`],
      conceptNote: 'Multiply every term of the first bracket by every term of the second, then combine like terms.' };
  },

  exponents(r, L) {
    if (L === 1) {
      const base = r.int(2, 5); const n = r.int(2, base === 2 ? 7 : 4);
      return { text: `Evaluate $${base}^{${n}}$.`, ...numeric(base ** n),
        explanation: [`$${base}^{${n}}$ means ${base} multiplied by itself ${n} times.`, `$${Array(n).fill(base).join(' \\times ')} = ${base ** n}$.`],
        conceptNote: 'aⁿ means a multiplied by itself n times. The base is a and the exponent (power) is n.' };
    }
    if (L === 2) {
      const base = r.pick(['a', 'x', 'y', '3', '5']); const m = r.int(2, 9); const n = r.int(2, 9);
      return { text: `Simplify $${base}^{${m}} \\times ${base}^{${n}}$.`, ...mcq(r, `$${base}^{${m + n}}$`, [`$${base}^{${m * n}}$`, `$${base}^{${Math.abs(m - n) || 1}}$`, `$${base}^{${m + n + 1}}$`]),
        explanation: ['When multiplying powers with the same base, add the exponents: $a^m \\times a^n = a^{m+n}$.', `$${m} + ${n} = ${m + n}$, so the answer is $${base}^{${m + n}}$.`],
        conceptNote: 'Laws of exponents: aᵐ × aⁿ = aᵐ⁺ⁿ, aᵐ ÷ aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ.' };
    }
    const base = r.int(2, 5); const n = r.int(2, 3);
    return { text: `Find the value of $${base}^{-${n}}$.`, ...mcq(r, `$\\frac{1}{${base ** n}}$`, [`$-${base ** n}$`, `$-\\frac{1}{${base ** n}}$`, `$\\frac{1}{${base * n}}$`]),
      explanation: ['A negative exponent means the reciprocal: $a^{-n} = \\frac{1}{a^n}$.', `$${base}^{${n}} = ${base ** n}$.`, `So $${base}^{-${n}} = \\frac{1}{${base ** n}}$.`],
      conceptNote: 'a⁻ⁿ = 1/aⁿ. A negative exponent never makes the value negative; it flips the number to its reciprocal.' };
  },

  polygons(r, L) {
    if (L === 1) {
      const n = r.int(5, 10);
      return { text: `Find the sum of the interior angles of a polygon with ${n} sides (in degrees).`, ...numeric((n - 2) * 180),
        explanation: ['A polygon with $n$ sides can be split into $(n - 2)$ triangles.', `Sum $= (${n} - 2) \\times 180^\\circ = ${(n - 2) * 180}^\\circ$.`],
        conceptNote: 'The interior angle sum of an n-sided polygon is (n − 2) × 180°.' };
    }
    const n = r.pick([5, 6, 8, 9, 10, 12, 15, 18, 20]);
    if (L === 2) {
      return { text: `Find each exterior angle of a regular polygon with ${n} sides (in degrees).`, ...numeric(360 / n),
        explanation: ['The exterior angles of any polygon add up to $360^\\circ$.', `Each exterior angle $= \\frac{360^\\circ}{${n}} = ${360 / n}^\\circ$.`],
        conceptNote: 'For every polygon, the exterior angles sum to 360°. In a regular polygon they are all equal.' };
    }
    return { text: `Find each interior angle of a regular polygon with ${n} sides (in degrees).`, ...numeric(180 - 360 / n),
      explanation: [`Each exterior angle $= \\frac{360^\\circ}{${n}} = ${360 / n}^\\circ$.`, `Interior angle $= 180^\\circ - ${360 / n}^\\circ = ${180 - 360 / n}^\\circ$.`],
      conceptNote: 'Each interior angle and its exterior angle form a straight line, so interior = 180° − exterior.' };
  },

  probability(r, L) {
    const items = [
      ['an even number on a fair die', 3, 6], ['a number greater than 4 on a fair die', 2, 6], ['a prime number on a fair die', 3, 6],
      ['a head when a fair coin is tossed', 1, 2], ['a king from a well-shuffled deck of 52 cards', 4, 52], ['a red card from a deck of 52 cards', 26, 52],
      ['a heart from a deck of 52 cards', 13, 52], ['a multiple of 3 on a fair die', 2, 6],
    ];
    const [what, fav, tot] = L === 3 ? r.pick(items.slice(4)) : r.pick(items.slice(0, 4).concat(items.slice(7)));
    const ans = frac(fav, tot);
    return { text: `What is the probability of getting ${what}?`, ...mcq(r, `$${ans}$`, [`$${frac(tot - fav || 1, tot)}$`, `$${frac(fav, tot + 1)}$`, `$${frac(1, fav + 2)}$`]),
      explanation: [`Number of favourable outcomes $= ${fav}$.`, `Total possible outcomes $= ${tot}$.`, `$P = \\frac{${fav}}{${tot}} = ${ans}$.`],
      conceptNote: 'Probability of an event = (number of favourable outcomes) ÷ (total number of equally likely outcomes). It always lies between 0 and 1.' };
  },

  squares(r, L) {
    if (L === 3) {
      const n = r.int(11, 29);
      return { text: `Find $\\sqrt{${(n * n) / 100}}$.`, ...numeric(n / 10, 0.001),
        explanation: [`Write as a fraction: $${(n * n) / 100} = \\frac{${n * n}}{100}$.`, `$\\sqrt{${n * n}} = ${n}$ and $\\sqrt{100} = 10$.`, `So the answer is $\\frac{${n}}{10} = ${n / 10}$.`],
        conceptNote: 'The square root of a decimal can be found by writing it as a fraction with a perfect-square denominator (100, 10000 …).' };
    }
    const n = L === 1 ? r.int(4, 25) : r.int(26, 99);
    return { text: `Find $\\sqrt{${n * n}}$.`, ...numeric(n),
      explanation: [`We need a number that multiplied by itself gives ${n * n}.`, `$${n} \\times ${n} = ${n * n}$, so $\\sqrt{${n * n}} = ${n}$.`],
      conceptNote: 'The square root of a number n is the number which, when multiplied by itself, gives n. Prime factorisation (pairing equal factors) is a reliable way to find it.' };
  },

  cubes(r, L) {
    const n = r.int(2 + L, 6 + 4 * L);
    if (L === 1) {
      return { text: `Find the cube of ${n}.`, ...numeric(n ** 3),
        explanation: [`$${n}^3 = ${n} \\times ${n} \\times ${n}$.`, `$= ${n ** 3}$.`], conceptNote: 'The cube of a number is the number multiplied by itself three times.' };
    }
    return { text: `Find $\\sqrt[3]{${n ** 3}}$.`, ...numeric(n),
      explanation: ['Group the prime factors in triples.', `$${n ** 3} = ${n} \\times ${n} \\times ${n}$.`, `So $\\sqrt[3]{${n ** 3}} = ${n}$.`],
      conceptNote: 'For a cube root, split the number into prime factors and make groups of three equal factors; take one factor from each group.' };
  },

  coord(r, L) {
    if (L === 1) {
      const x = r.nz(-9, 9); const y = r.nz(-9, 9);
      const q = x > 0 && y > 0 ? 'I' : x < 0 && y > 0 ? 'II' : x < 0 ? 'III' : 'IV';
      return { text: `In which quadrant does the point $(${x}, ${y})$ lie?`, ...mcq(r, `Quadrant ${q}`, ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV']),
        explanation: [`x-coordinate is ${x > 0 ? 'positive' : 'negative'}, y-coordinate is ${y > 0 ? 'positive' : 'negative'}.`, `Signs $(${x > 0 ? '+' : '-'}, ${y > 0 ? '+' : '-'})$ belong to Quadrant ${q}.`],
        conceptNote: 'Quadrant signs: I (+, +), II (−, +), III (−, −), IV (+, −). Counting goes anticlockwise from the top-right.' };
    }
    const [a, b, c] = r.pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]]);
    const x1 = r.int(-5, 5); const y1 = r.int(-5, 5);
    if (L === 2) {
      return { text: `Find the distance between $(${x1}, ${y1})$ and $(${x1 + a}, ${y1 + b})$.`, ...numeric(c),
        explanation: ['Distance formula: $d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.', `$d = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}}$.`, `$d = ${c}$ units.`],
        conceptNote: 'The distance formula is Pythagoras applied to the horizontal and vertical gaps between two points.' };
    }
    const x2 = x1 + 2 * a; const y2 = y1 + 2 * b;
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
    return { text: `Find the mid-point of the segment joining $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
      ...mcq(r, `$(${mx}, ${my})$`, [`$(${my}, ${mx})$`, `$(${x2 - x1}, ${y2 - y1})$`, `$(${mx + 1}, ${my})$`]),
      explanation: ['Mid-point formula: $\\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)$.', `$\\left(\\frac{${x1} + ${p(x2)}}{2}, \\frac{${y1} + ${p(y2)}}{2}\\right) = (${mx}, ${my})$.`],
      conceptNote: 'The mid-point is the average of the x-coordinates and the average of the y-coordinates.' };
  },

  poly(r, L) {
    if (L === 1) {
      const a = r.nz(1, 4); const b = r.nz(-6, 6); const c = r.int(-9, 9); const k = r.nz(-3, 3);
      const val = a * k * k + b * k + c;
      return { text: `If $p(x) = ${a === 1 ? '' : a}x^2 ${signed(b)}x ${signed(c)}$, find $p(${k})$.`, ...numeric(val),
        explanation: [`Substitute $x = ${k}$: $p(${k}) = ${a}${p(k)}^2 ${signed(b)} \\times ${p(k)} ${signed(c)}$.`, `$= ${a * k * k} ${signed(b * k)} ${signed(c)} = ${val}$.`],
        conceptNote: 'To find the value of a polynomial at x = k, replace every x with k and simplify carefully, keeping track of signs.' };
    }
    if (L === 2) {
      const a = r.nz(2, 7); const b = r.nz(-12, 12);
      const z = frac(-b, a);
      return { text: `Find the zero of the polynomial $p(x) = ${lin(a, b)}$.`, ...mcq(r, `$${z}$`, [`$${frac(b, a)}$`, `$${frac(a, -b || 1)}$`, `$${-b}$`]),
        explanation: [`Set $p(x) = 0$: $${lin(a, b)} = 0$.`, `$${a}x = ${-b}$.`, `$x = ${z}$.`],
        conceptNote: 'A zero of a polynomial is the value of x that makes the polynomial equal to 0. For ax + b, the zero is −b/a.' };
    }
    const r1 = r.nz(-6, 6); const r2 = r.nz(-6, 6);
    const B = -(r1 + r2); const C = r1 * r2;
    return { text: `Find the sum of the zeroes of $x^2 ${signed(B)}x ${signed(C)}$.`, ...numeric(r1 + r2),
      explanation: ['For $ax^2 + bx + c$, sum of zeroes $= -\\frac{b}{a}$.', `Here $a = 1$, $b = ${B}$.`, `Sum $= -\\frac{${B}}{1} = ${r1 + r2}$.`],
      conceptNote: 'For a quadratic ax² + bx + c: sum of zeroes = −b/a and product of zeroes = c/a.' };
  },

  circles(r, L) {
    if (L === 1) {
      const rad = r.int(3, 25);
      return { text: `The radius of a circle is ${rad} cm. Find its diameter (in cm).`, ...numeric(2 * rad),
        explanation: ['Diameter $= 2 \\times$ radius.', `$= 2 \\times ${rad} = ${2 * rad}$ cm.`], conceptNote: 'The diameter is the longest chord and passes through the centre; it is twice the radius.' };
    }
    const a = r.int(20, 80);
    if (L === 2) {
      return { text: `An arc subtends $${a}^\\circ$ at a point on the circle. Find the angle it subtends at the centre (in degrees).`, ...numeric(2 * a),
        explanation: ['The angle at the centre is double the angle at any point on the remaining circle.', `$2 \\times ${a}^\\circ = ${2 * a}^\\circ$.`],
        conceptNote: 'The angle subtended by an arc at the centre is twice the angle it subtends at any point on the remaining part of the circle.' };
    }
    return { text: `In a cyclic quadrilateral $ABCD$, $\\angle A = ${a + 40}^\\circ$. Find $\\angle C$ (in degrees).`, ...numeric(140 - a),
      explanation: ['Opposite angles of a cyclic quadrilateral are supplementary.', `$\\angle C = 180^\\circ - ${a + 40}^\\circ = ${140 - a}^\\circ$.`],
      conceptNote: 'In a cyclic quadrilateral (all vertices on a circle), each pair of opposite angles adds up to 180°.' };
  },

  heron(r, L) {
    const [t, area] = r.pick([[[13, 14, 15], 84], [[5, 12, 13], 30], [[6, 8, 10], 24], [[10, 13, 13], 60], [[9, 10, 17], 36]]);
    const k = L === 3 ? 2 : 1;
    const [a, b, c] = t.map((v) => v * k);
    const s = (a + b + c) / 2;
    return { text: `Find the area of a triangle with sides ${a} cm, ${b} cm and ${c} cm (in cm²).`, ...numeric(area * k * k),
      explanation: [`Semi-perimeter $s = \\frac{${a} + ${b} + ${c}}{2} = ${s}$.`, `Area $= \\sqrt{s(s-a)(s-b)(s-c)} = \\sqrt{${s} \\times ${s - a} \\times ${s - b} \\times ${s - c}}$.`, `Area $= ${area * k * k}$ cm².`],
      conceptNote: "Heron's formula gives the area of a triangle from its three sides: √(s(s−a)(s−b)(s−c)), where s is half the perimeter." };
  },

  quadratic(r, L) {
    if (L === 3) {
      const b = r.int(2, 9); const c = r.int(1, 20);
      const D = b * b - 4 * c;
      const nature = D > 0 ? 'Two distinct real roots' : D === 0 ? 'Two equal real roots' : 'No real roots';
      return { text: `What is the nature of the roots of $x^2 + ${b}x + ${c} = 0$?`, ...mcq(r, nature, ['Two distinct real roots', 'Two equal real roots', 'No real roots', 'Only one root which is negative']),
        explanation: ['Discriminant $D = b^2 - 4ac$.', `$D = ${b}^2 - 4(1)(${c}) = ${D}$.`, `$D ${D > 0 ? '> 0' : D === 0 ? '= 0' : '< 0'}$, so: ${nature.toLowerCase()}.`],
        conceptNote: 'For ax² + bx + c = 0, D = b² − 4ac decides the roots: D > 0 two distinct real, D = 0 two equal real, D < 0 no real roots.' };
    }
    const r1 = r.nz(-7, 7); let r2 = r.nz(-7, 7); if (r2 === r1) r2 = -r1 || 2;
    const B = -(r1 + r2); const C = r1 * r2;
    return { text: `Solve: $x^2 ${B === 0 ? '' : `${signed(B)}x `}${signed(C)} = 0$`,
      ...mcq(r, `$x = ${r1}, ${r2}$`, [`$x = ${-r1}, ${-r2}$`, `$x = ${r1}, ${-r2}$`, `$x = ${r1 + 1}, ${r2 - 1}$`]),
      explanation: [`Find two numbers with product ${C} and sum ${-B}: they are ${p(-r1)} and ${p(-r2)}.`, `Factorise: $(x ${signed(-r1)})(x ${signed(-r2)}) = 0$.`, `So $x = ${r1}$ or $x = ${r2}$.`],
      conceptNote: 'To factorise x² + bx + c, find two numbers whose product is c and whose sum is b. Each factor set to zero gives a root.' };
  },

  ap(r, L) {
    const a = r.int(-5, 12); const d = r.nz(-4, 7); const n = r.int(8, 25);
    if (L < 3) {
      const tn = a + (n - 1) * d;
      return { text: `Find the ${n}th term of the AP: $${a}, ${a + d}, ${a + 2 * d}, \\ldots$`, ...numeric(tn),
        explanation: [`First term $a = ${a}$, common difference $d = ${d}$.`, `$a_n = a + (n - 1)d = ${a} + (${n} - 1)(${d})$.`, `$a_{${n}} = ${tn}$.`],
        conceptNote: 'In an arithmetic progression each term is obtained by adding the same number d. The nth term is aₙ = a + (n − 1)d.' };
    }
    const S = (n * (2 * a + (n - 1) * d)) / 2;
    return { text: `Find the sum of the first ${n} terms of the AP: $${a}, ${a + d}, ${a + 2 * d}, \\ldots$`, ...numeric(S),
      explanation: [`$a = ${a}$, $d = ${d}$, $n = ${n}$.`, `$S_n = \\frac{n}{2}[2a + (n - 1)d] = \\frac{${n}}{2}[${2 * a} + ${(n - 1) * d}]$.`, `$S_{${n}} = ${S}$.`],
      conceptNote: 'The sum of the first n terms of an AP is Sₙ = n/2 [2a + (n − 1)d], or n/2 (first term + last term).' };
  },

  trig(r, L) {
    const table = [
      ['\\sin 30^\\circ', '\\frac{1}{2}'], ['\\cos 60^\\circ', '\\frac{1}{2}'], ['\\tan 45^\\circ', '1'], ['\\sin 90^\\circ', '1'],
      ['\\cos 30^\\circ', '\\frac{\\sqrt{3}}{2}'], ['\\tan 60^\\circ', '\\sqrt{3}'], ['\\sin 45^\\circ', '\\frac{1}{\\sqrt{2}}'], ['\\tan 30^\\circ', '\\frac{1}{\\sqrt{3}}'],
    ];
    if (L < 3) {
      const [f, v] = r.pick(table);
      return { text: `Find the value of $${f}$.`, ...mcq(r, `$${v}$`, table.map((t) => `$${t[1]}$`)),
        explanation: ['Recall the standard trigonometric table for $0^\\circ, 30^\\circ, 45^\\circ, 60^\\circ, 90^\\circ$.', `$${f} = ${v}$.`],
        conceptNote: 'Memorise sin 0°, 30°, 45°, 60°, 90° as √0/2, √1/2, √2/2, √3/2, √4/2. Cos runs the same values in reverse, and tan = sin ÷ cos.' };
    }
    const d = r.int(5, 40) * 2;
    return { text: `From a point ${d} m from the foot of a tower, the angle of elevation of its top is $45^\\circ$. Find the height of the tower (in m).`, ...numeric(d),
      explanation: ['$\\tan 45^\\circ = \\frac{\\text{height}}{\\text{distance}}$.', `$1 = \\frac{h}{${d}}$.`, `$h = ${d}$ m.`],
      conceptNote: 'In heights-and-distances problems, draw the right triangle; tan θ = opposite ÷ adjacent links the height to the horizontal distance.' };
  },

  mensuration(r, L) {
    if (L === 1) {
      const l = r.int(4, 30); const b = r.int(3, l);
      return { text: `A rectangle is ${l} cm long and ${b} cm wide. Find its area (in cm²).`, ...numeric(l * b),
        explanation: ['Area of a rectangle $= \\text{length} \\times \\text{breadth}$.', `$= ${l} \\times ${b} = ${l * b}$ cm².`],
        conceptNote: 'Area measures the surface inside a shape (square units); perimeter measures the boundary (units). Rectangle: A = l × b, P = 2(l + b).' };
    }
    if (L === 2) {
      const a = r.int(4, 20); const b = r.int(a + 2, a + 20); const h = r.int(2, 12) * 2;
      return { text: `Find the area of a trapezium with parallel sides ${a} cm and ${b} cm and height ${h} cm (in cm²).`, ...numeric(((a + b) * h) / 2),
        explanation: ['Area of a trapezium $= \\frac{1}{2}(a + b) \\times h$.', `$= \\frac{1}{2}(${a} + ${b}) \\times ${h}$.`, `$= ${((a + b) * h) / 2}$ cm².`],
        conceptNote: 'A trapezium’s area is the average of its parallel sides multiplied by the perpendicular distance between them.' };
    }
    const rad = r.pick([7, 14, 21, 28, 35]);
    return { text: `Find the area of a circle of radius ${rad} cm. Use $\\pi = \\frac{22}{7}$ (in cm²).`, ...numeric((22 * rad * rad) / 7),
      explanation: ['Area $= \\pi r^2$.', `$= \\frac{22}{7} \\times ${rad} \\times ${rad}$.`, `$= ${(22 * rad * rad) / 7}$ cm².`],
      conceptNote: 'Area of a circle = πr² and circumference = 2πr. Choosing π = 22/7 is convenient when the radius is a multiple of 7.' };
  },

  data(r, L) {
    const n = L === 1 ? 5 : 7;
    const vals = Array.from({ length: n }, () => r.int(2, 20 * L));
    if (L === 2) {
      const sorted = [...vals].sort((a, b) => a - b);
      return { text: `Find the median of: ${vals.join(', ')}.`, ...numeric(sorted[3]),
        explanation: [`Arrange in order: ${sorted.join(', ')}.`, 'There are 7 values, so the median is the 4th value.', `Median $= ${sorted[3]}$.`],
        conceptNote: 'The median is the middle value after arranging data in order. For an even count, it is the mean of the two middle values.' };
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    const fix = (n - (sum % n)) % n;
    vals[0] += fix;
    const total = sum + fix;
    return { text: `Find the mean of: ${vals.join(', ')}.`, ...numeric(total / n),
      explanation: [`Sum $= ${vals.join(' + ')} = ${total}$.`, `Number of values $= ${n}$.`, `Mean $= \\frac{${total}}{${n}} = ${total / n}$.`],
      conceptNote: 'The mean (average) is the sum of all observations divided by the number of observations.' };
  },
};

export function generateQuestion(family, rng, difficulty) {
  const gen = G[family] || G.integers;
  return gen(rng, LEVEL[difficulty] || 1);
}
