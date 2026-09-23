import { getTopic } from './curriculum';

/**
 * Study material is stored as "GG-Markdown": a small safe subset rendered by <RichText />
 *   ## heading · - bullet · > tip · >> worked example · $$display maths$$ · **bold** · $inline maths$
 * No raw HTML is ever rendered, so admin-authored material cannot inject markup.
 */
const NOTES = {
  numbers: {
    idea: 'Every whole number can be broken into prime factors in exactly one way. Factors, multiples, HCF and LCM all come from this idea.',
    formula: '\\text{HCF}(a,b) \\times \\text{LCM}(a,b) = a \\times b',
    points: ['A **factor** divides a number exactly; a **multiple** is the number times a counting number.', 'A **prime** has exactly two factors: 1 and itself.', 'HCF = product of the common prime factors (lowest powers).', 'LCM = product of all prime factors (highest powers).'],
    example: 'HCF of 12 and 18: $12 = 2^2 \\times 3$, $18 = 2 \\times 3^2$. Common part $= 2 \\times 3 = 6$. LCM $= 2^2 \\times 3^2 = 36$. Check: $6 \\times 36 = 216 = 12 \\times 18$.',
    tip: 'Always check your HCF divides both numbers and your LCM is divisible by both.',
  },
  integers: {
    idea: 'Integers are whole numbers together with their negatives. The number line is the best tool for adding and subtracting them.',
    formula: 'a - b = a + (-b)',
    points: ['Adding a positive number moves right on the number line; adding a negative moves left.', 'Subtracting a number = adding its opposite.', 'Same signs multiply to a positive; different signs multiply to a negative.'],
    example: '$(-7) - (-3) = (-7) + 3 = -4$',
    tip: 'Put brackets around negative numbers while working, e.g. $(-4) \\times (-5)$, so no sign gets lost.',
  },
  fractions: {
    idea: 'A fraction names equal parts of a whole. To add or subtract fractions, the parts must be the same size — that means a common denominator.',
    formula: '\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}',
    points: ['Equivalent fractions: multiply or divide the numerator and denominator by the same number.', 'Add/subtract: use the LCM of denominators.', 'Multiply: numerator × numerator, denominator × denominator.', 'Divide: multiply by the reciprocal.'],
    example: '$\\frac{2}{3} + \\frac{1}{4} = \\frac{8}{12} + \\frac{3}{12} = \\frac{11}{12}$',
    tip: 'Never add the denominators. $\\frac{1}{2} + \\frac{1}{2}$ is $1$, not $\\frac{2}{4}$!',
  },
  decimals: {
    idea: 'Decimals are fractions with denominators 10, 100, 1000 … The position of each digit tells its value.',
    formula: '0.25 = \\frac{25}{100} = \\frac{1}{4}',
    points: ['Line up the decimal points when adding or subtracting.', 'When multiplying, count the total decimal places in both numbers.', 'Comparing: compare digit by digit from the left.'],
    example: '$1.2 \\times 0.3$: $12 \\times 3 = 36$, two decimal places in total, so $0.36$.',
    tip: 'Estimate first: $1.2 \\times 0.3$ should be a bit more than $0.3$.',
  },
  data: {
    idea: 'Data handling is about collecting, organising and summarising information so patterns become visible.',
    formula: '\\text{Mean} = \\frac{\\text{Sum of observations}}{\\text{Number of observations}}',
    points: ['**Mean**: the average value.', '**Median**: the middle value after sorting.', '**Mode**: the most frequent value.', 'Bar graphs compare quantities; pie charts show parts of a whole.'],
    example: 'Mean of 4, 8, 6, 10, 2: sum $= 30$, count $= 5$, mean $= 6$.',
    tip: 'Always sort the data before finding the median.',
  },
  mensuration: {
    idea: 'Mensuration is the measurement of lengths, areas and volumes of shapes and solids.',
    formula: 'A_{\\text{rectangle}} = l \\times b \\qquad A_{\\text{circle}} = \\pi r^2',
    points: ['Perimeter is measured in units (cm); area in square units (cm²); volume in cubic units (cm³).', 'Triangle: $A = \\frac{1}{2} \\times b \\times h$.', 'Trapezium: $A = \\frac{1}{2}(a + b)h$.', 'Cuboid: $V = l \\times b \\times h$.'],
    example: 'Circle with $r = 7$ cm: $A = \\frac{22}{7} \\times 7 \\times 7 = 154$ cm².',
    tip: 'Write the units at every step — it catches many mistakes.',
  },
  linear: {
    idea: 'An equation is a balance. Whatever you do to one side, you must do to the other, so the balance is kept.',
    formula: 'ax + b = c \\;\\Rightarrow\\; x = \\frac{c - b}{a}',
    points: ['Collect all variable terms on one side and constants on the other.', 'A term that crosses the “=” sign changes its sign.', 'Finally divide by the coefficient of $x$.', 'Always substitute your answer back to check.'],
    example: '$5x - 3 = 2x + 9 \\Rightarrow 5x - 2x = 9 + 3 \\Rightarrow 3x = 12 \\Rightarrow x = 4$',
    tip: 'The most common mistake is forgetting to change the sign when moving a term. Say it aloud: “plus becomes minus”.',
  },
  ratio: {
    idea: 'A ratio compares two quantities of the same kind. Proportion says two ratios are equal.',
    formula: '\\frac{x_1}{y_1} = \\frac{x_2}{y_2} \\;(\\text{direct}) \\qquad x_1 y_1 = x_2 y_2 \\;(\\text{inverse})',
    points: ['Direct proportion: both quantities change in the same direction.', 'Inverse proportion: one goes up, the other goes down.', 'The unitary method finds the value of one unit first.'],
    example: '5 pens cost ₹60, so 1 pen costs ₹12 and 8 pens cost ₹96.',
    tip: 'Ask: “If one doubles, does the other double (direct) or halve (inverse)?”',
  },
  angles: {
    idea: 'Angles measure turning. Many geometry facts are just “angles on a straight line add to 180°” in disguise.',
    formula: '\\angle A + \\angle B + \\angle C = 180^\\circ',
    points: ['Complementary angles sum to $90^\\circ$; supplementary to $180^\\circ$.', 'Vertically opposite angles are equal.', 'With parallel lines: corresponding and alternate angles are equal.', 'Exterior angle of a triangle = sum of the two interior opposite angles.'],
    example: 'A triangle has angles $50^\\circ$ and $60^\\circ$, so the third is $180^\\circ - 110^\\circ = 70^\\circ$.',
    tip: 'Mark every angle you know on the diagram before you start.',
  },
  percent: {
    idea: 'Per cent means “out of 100”. Percentages make it easy to compare changes, discounts and interest.',
    formula: 'x\\% \\text{ of } N = \\frac{x}{100} \\times N \\qquad SI = \\frac{PRT}{100}',
    points: ['Profit/loss is calculated on the cost price.', 'Discount is calculated on the marked price.', 'Simple interest grows by the same amount each year.'],
    example: '20% discount on ₹500: discount $= ₹100$, selling price $= ₹400$.',
    tip: 'Always ask “percent of what?” — the base value matters.',
  },
  algebra: {
    idea: 'Algebraic expressions use letters for unknown numbers. We simplify them by combining like terms and using identities.',
    formula: '(a + b)^2 = a^2 + 2ab + b^2',
    points: ['Like terms have the same variables with the same powers.', '$(a - b)^2 = a^2 - 2ab + b^2$', '$(a + b)(a - b) = a^2 - b^2$', '$(x + a)(x + b) = x^2 + (a + b)x + ab$'],
    example: '$(x + 3)^2 = x^2 + 6x + 9$',
    tip: '$(a + b)^2$ is never just $a^2 + b^2$ — do not forget the middle term.',
  },
  exponents: {
    idea: 'Exponents are a short way to write repeated multiplication.',
    formula: 'a^m \\times a^n = a^{m+n} \\qquad a^{-n} = \\frac{1}{a^n} \\qquad a^0 = 1',
    points: ['$a^m \\div a^n = a^{m-n}$', '$(a^m)^n = a^{mn}$', '$(ab)^n = a^n b^n$', 'Standard form: $k \\times 10^n$ with $1 \\le k < 10$.'],
    example: '$2^3 \\times 2^4 = 2^7 = 128$',
    tip: 'Laws of exponents only combine powers with the **same base**.',
  },
  polygons: {
    idea: 'A polygon is a closed figure made of line segments. Its angles follow neat rules based on the number of sides.',
    formula: '\\text{Interior angle sum} = (n - 2) \\times 180^\\circ',
    points: ['The exterior angles of any polygon add up to $360^\\circ$.', 'In a regular polygon all sides and all angles are equal.', 'Parallelogram: opposite sides and opposite angles are equal; diagonals bisect each other.'],
    example: 'Regular hexagon: each exterior angle $= 360^\\circ \\div 6 = 60^\\circ$, each interior angle $= 120^\\circ$.',
    tip: 'Use the exterior angle to find the interior angle — it is quicker.',
  },
  probability: {
    idea: 'Probability measures how likely an event is, on a scale from 0 (impossible) to 1 (certain).',
    formula: 'P(E) = \\frac{\\text{Number of favourable outcomes}}{\\text{Total number of outcomes}}',
    points: ['$0 \\le P(E) \\le 1$', '$P(E) + P(\\text{not } E) = 1$', 'A fair die has 6 equally likely outcomes; a deck has 52 cards.'],
    example: 'Probability of an even number on a die $= \\frac{3}{6} = \\frac{1}{2}$.',
    tip: 'List the outcomes when unsure — it is the safest method.',
  },
  squares: {
    idea: 'A perfect square is a number multiplied by itself. The square root undoes squaring.',
    formula: '\\sqrt{a^2} = a \\qquad \\sqrt{ab} = \\sqrt{a}\\,\\sqrt{b}',
    points: ['Squares never end in 2, 3, 7 or 8.', 'Use prime factorisation and pair equal factors.', 'Irrational numbers like $\\sqrt{2}$ have non-terminating, non-repeating decimals.'],
    example: '$\\sqrt{324} = \\sqrt{2^2 \\times 3^4} = 2 \\times 3^2 = 18$',
    tip: 'Estimate: $18^2 = 324$ lies between $17^2 = 289$ and $19^2 = 361$.',
  },
  cubes: {
    idea: 'A perfect cube is a number multiplied by itself three times. The cube root undoes cubing.',
    formula: '\\sqrt[3]{a^3} = a',
    points: ['Group prime factors in threes.', 'The cube of a negative number is negative.', 'Cubes of even numbers are even; cubes of odd numbers are odd.'],
    example: '$\\sqrt[3]{216} = \\sqrt[3]{2^3 \\times 3^3} = 6$',
    tip: 'Know the cubes from 1 to 10 by heart — they come up often.',
  },
  coord: {
    idea: 'Coordinates fix the position of a point using two numbers: how far across (x) and how far up (y).',
    formula: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
    points: ['Quadrants: I (+,+), II (−,+), III (−,−), IV (+,−).', 'Mid-point $= \\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)$.', 'Points on the x-axis have $y = 0$.'],
    example: 'Distance from $(1, 2)$ to $(4, 6)$: $\\sqrt{3^2 + 4^2} = 5$.',
    tip: 'Sketch a quick grid — seeing the points prevents sign errors.',
  },
  poly: {
    idea: 'A polynomial is an expression with whole-number powers of a variable. Its zeroes are where its value is 0.',
    formula: '\\alpha + \\beta = -\\frac{b}{a} \\qquad \\alpha\\beta = \\frac{c}{a}',
    points: ['Degree = highest power of the variable.', 'Remainder theorem: remainder of $p(x) \\div (x - a)$ is $p(a)$.', 'Factor theorem: $(x - a)$ is a factor if $p(a) = 0$.'],
    example: '$p(x) = x^2 - 5x + 6$ has zeroes 2 and 3: sum $= 5$, product $= 6$.',
    tip: 'Substitute carefully with brackets: $p(-2) = (-2)^2 - 5(-2) + 6$.',
  },
  circles: {
    idea: 'A circle is the set of points at a fixed distance (radius) from the centre. Its angle properties are elegant and very useful.',
    formula: '\\angle \\text{at centre} = 2 \\times \\angle \\text{at circumference}',
    points: ['Angles in the same segment are equal.', 'The angle in a semicircle is $90^\\circ$.', 'Opposite angles of a cyclic quadrilateral sum to $180^\\circ$.', 'A tangent is perpendicular to the radius at the point of contact.'],
    example: 'If an arc makes $35^\\circ$ at the circumference, it makes $70^\\circ$ at the centre.',
    tip: 'Draw radii to the points given — it often reveals isosceles triangles.',
  },
  heron: {
    idea: "Heron's formula finds the area of any triangle when you know all three sides — no height needed.",
    formula: 'A = \\sqrt{s(s-a)(s-b)(s-c)}, \\quad s = \\frac{a+b+c}{2}',
    points: ['First find the semi-perimeter $s$.', 'Then multiply $s$ by each of $(s - a)$, $(s - b)$, $(s - c)$.', 'Take the square root.'],
    example: 'Sides 13, 14, 15: $s = 21$, $A = \\sqrt{21 \\times 8 \\times 7 \\times 6} = 84$.',
    tip: 'Factorise inside the square root before multiplying — the numbers stay small.',
  },
  quadratic: {
    idea: 'A quadratic equation has the form $ax^2 + bx + c = 0$ with $a \\ne 0$. It has at most two roots.',
    formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    points: ['Factorise by splitting the middle term.', 'Discriminant $D = b^2 - 4ac$ tells the nature of the roots.', 'Check roots by substituting back.'],
    example: '$x^2 - 5x + 6 = 0 \\Rightarrow (x - 2)(x - 3) = 0 \\Rightarrow x = 2, 3$',
    tip: 'Write the equation in standard form (everything on one side, $= 0$) before solving.',
  },
  ap: {
    idea: 'An arithmetic progression is a list of numbers where each term is found by adding the same number (the common difference).',
    formula: 'a_n = a + (n - 1)d \\qquad S_n = \\frac{n}{2}[2a + (n - 1)d]',
    points: ['$d = a_2 - a_1$ (can be negative).', 'The nth term from the end $= l - (n - 1)d$.', '$S_n = \\frac{n}{2}(a + l)$ when the last term $l$ is known.'],
    example: '3, 7, 11, …: $a = 3$, $d = 4$, $a_{10} = 3 + 9 \\times 4 = 39$.',
    tip: 'It is $(n - 1)d$, not $nd$ — the first term has had no differences added.',
  },
  trig: {
    idea: 'Trigonometric ratios compare the sides of a right-angled triangle with respect to one of its acute angles.',
    formula: '\\sin\\theta = \\frac{\\text{opp}}{\\text{hyp}},\\; \\cos\\theta = \\frac{\\text{adj}}{\\text{hyp}},\\; \\tan\\theta = \\frac{\\text{opp}}{\\text{adj}}',
    points: ['$\\sin^2\\theta + \\cos^2\\theta = 1$', '$\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}$', 'Standard angles: $0^\\circ, 30^\\circ, 45^\\circ, 60^\\circ, 90^\\circ$.'],
    example: 'A ladder makes $60^\\circ$ with the ground and reaches 6 m high: length $= \\frac{6}{\\sin 60^\\circ} = 4\\sqrt{3}$ m.',
    tip: 'Remember “SOH CAH TOA”.',
  },
};

export function defaultMaterialFor(topicId) {
  const t = getTopic(topicId);
  if (!t) return null;
  const n = NOTES[t.family] || NOTES.integers;
  const body = [
    `## ${t.name}`,
    `${n.idea}`,
    '## Key formula',
    `$$${n.formula}$$`,
    '## Remember',
    ...n.points.map((pt) => `- ${pt}`),
    '## Worked example',
    `>> ${n.example}`,
    `> ${n.tip}`,
  ].join('\n');

  const hasVideo = t.number % 2 === 1;
  return {
    id: `mat_${topicId}`,
    topicId,
    title: `${t.name} — Notes`,
    status: 'PUBLISHED',
    version: 1,
    updatedAt: '2026-09-10T09:00:00.000Z',
    blocks: [
      { type: 'TEXT', body },
      { type: 'PDF', title: `${t.name} — Practice sheet.pdf`, pages: 3, url: `mock://pdf/${topicId}` },
      ...(hasVideo ? [{ type: 'VIDEO', title: `${t.name} in 6 minutes`, durationSec: 360, url: `mock://video/${topicId}` }] : []),
    ],
  };
}
