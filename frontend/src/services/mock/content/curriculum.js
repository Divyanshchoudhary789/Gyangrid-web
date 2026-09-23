/**
 * NCERT / CBSE Mathematics syllabus, Classes 6–10 (Board → Class → Subject → Chapter → Topic).
 * `family` selects the question generator + material template used by the mock content engine.
 */
const RAW = {
  6: [
    ['Knowing Our Numbers', 'numbers', ['Comparing Numbers', 'Large Numbers in Practice', 'Estimation and Rounding']],
    ['Whole Numbers', 'integers', ['Number Line', 'Properties of Whole Numbers', 'Patterns in Whole Numbers']],
    ['Playing with Numbers', 'numbers', ['Factors and Multiples', 'Prime Factorisation', 'HCF and LCM']],
    ['Basic Geometrical Ideas', 'angles', ['Lines, Rays and Segments', 'Angles', 'Polygons']],
    ['Integers', 'integers', ['Introduction to Integers', 'Addition of Integers', 'Subtraction of Integers']],
    ['Fractions', 'fractions', ['Types of Fractions', 'Equivalent Fractions', 'Addition and Subtraction of Fractions']],
    ['Decimals', 'decimals', ['Tenths and Hundredths', 'Comparing Decimals', 'Using Decimals']],
    ['Data Handling', 'data', ['Recording and Organising Data', 'Pictographs', 'Bar Graphs']],
    ['Mensuration', 'mensuration', ['Perimeter', 'Area of Rectangles and Squares']],
    ['Algebra', 'linear', ['Use of Variables', 'Expressions with Variables', 'Simple Equations']],
    ['Ratio and Proportion', 'ratio', ['Ratio', 'Proportion', 'Unitary Method']],
  ],
  7: [
    ['Integers', 'integers', ['Properties of Addition and Subtraction', 'Multiplication of Integers', 'Division of Integers']],
    ['Fractions and Decimals', 'fractions', ['Multiplication of Fractions', 'Division of Fractions', 'Multiplication of Decimals']],
    ['Data Handling', 'data', ['Mean', 'Median and Mode', 'Chance and Probability']],
    ['Simple Equations', 'linear', ['Setting Up an Equation', 'Solving an Equation', 'Applications of Simple Equations']],
    ['Lines and Angles', 'angles', ['Related Angles', 'Pairs of Lines', 'Transversals']],
    ['The Triangle and its Properties', 'angles', ['Angle Sum Property', 'Exterior Angle Property', 'Pythagoras Property']],
    ['Comparing Quantities', 'percent', ['Percentage', 'Profit and Loss', 'Simple Interest']],
    ['Rational Numbers', 'fractions', ['Positive and Negative Rational Numbers', 'Operations on Rational Numbers']],
    ['Perimeter and Area', 'mensuration', ['Area of a Parallelogram', 'Area of a Triangle', 'Circles']],
    ['Algebraic Expressions', 'algebra', ['Terms and Coefficients', 'Like and Unlike Terms', 'Value of an Expression']],
    ['Exponents and Powers', 'exponents', ['Laws of Exponents', 'Standard Form']],
  ],
  8: [
    ['Rational Numbers', 'fractions', ['Properties of Rational Numbers', 'Rational Numbers on the Number Line', 'Rational Numbers Between Two Numbers']],
    ['Linear Equations in One Variable', 'linear', ['Equations with Variables on Both Sides', 'Reducing Equations to Simpler Form', 'Word Problems on Linear Equations']],
    ['Understanding Quadrilaterals', 'polygons', ['Polygons and Angle Sum', 'Kinds of Quadrilaterals', 'Properties of Parallelograms']],
    ['Data Handling', 'probability', ['Grouping Data', 'Circle Graphs', 'Chance and Probability']],
    ['Squares and Square Roots', 'squares', ['Properties of Square Numbers', 'Finding Square Roots', 'Square Roots of Decimals']],
    ['Cubes and Cube Roots', 'cubes', ['Cubes', 'Cube Roots by Prime Factorisation']],
    ['Comparing Quantities', 'percent', ['Percentage Increase and Decrease', 'Discounts and GST', 'Compound Interest']],
    ['Algebraic Expressions and Identities', 'algebra', ['Multiplying Polynomials', 'Standard Identities', 'Applying Identities']],
    ['Mensuration', 'mensuration', ['Area of Trapezium and Polygons', 'Surface Area of Solids', 'Volume of Cube and Cuboid']],
    ['Exponents and Powers', 'exponents', ['Negative Exponents', 'Laws of Exponents', 'Very Small Numbers in Standard Form']],
    ['Direct and Inverse Proportions', 'ratio', ['Direct Proportion', 'Inverse Proportion']],
    ['Factorisation', 'algebra', ['Common Factors', 'Factorisation Using Identities', 'Division of Algebraic Expressions']],
    ['Introduction to Graphs', 'coord', ['Line Graphs', 'Linear Graphs', 'Coordinates']],
  ],
  9: [
    ['Number Systems', 'squares', ['Irrational Numbers', 'Real Numbers and Decimal Expansions', 'Laws of Exponents for Real Numbers']],
    ['Polynomials', 'poly', ['Polynomials in One Variable', 'Zeroes of a Polynomial', 'Remainder and Factor Theorem', 'Algebraic Identities']],
    ['Coordinate Geometry', 'coord', ['Cartesian System', 'Plotting Points']],
    ['Linear Equations in Two Variables', 'linear', ['Linear Equations', 'Solutions of a Linear Equation']],
    ["Introduction to Euclid's Geometry", 'angles', ["Euclid's Definitions and Axioms", "Euclid's Fifth Postulate"]],
    ['Lines and Angles', 'angles', ['Pairs of Angles', 'Parallel Lines and a Transversal', 'Angle Sum Property of a Triangle']],
    ['Triangles', 'angles', ['Congruence of Triangles', 'Properties of a Triangle', 'Inequalities in a Triangle']],
    ['Quadrilaterals', 'polygons', ['Properties of a Parallelogram', 'The Mid-point Theorem']],
    ['Circles', 'circles', ['Angle Subtended by a Chord', 'Cyclic Quadrilaterals']],
    ["Heron's Formula", 'heron', ["Area of a Triangle by Heron's Formula", "Applications of Heron's Formula"]],
    ['Surface Areas and Volumes', 'mensuration', ['Surface Area of a Cone and Sphere', 'Volume of a Cone and Sphere']],
    ['Statistics', 'data', ['Collection of Data', 'Graphical Representation of Data', 'Measures of Central Tendency']],
  ],
  10: [
    ['Real Numbers', 'numbers', ['Fundamental Theorem of Arithmetic', 'Revisiting Irrational Numbers']],
    ['Polynomials', 'poly', ['Geometrical Meaning of Zeroes', 'Relationship between Zeroes and Coefficients']],
    ['Pair of Linear Equations in Two Variables', 'linear', ['Graphical Method', 'Substitution Method', 'Elimination Method']],
    ['Quadratic Equations', 'quadratic', ['Standard Form of a Quadratic', 'Solution by Factorisation', 'Nature of Roots']],
    ['Arithmetic Progressions', 'ap', ['nth Term of an AP', 'Sum of First n Terms of an AP']],
    ['Triangles', 'angles', ['Similar Figures', 'Criteria for Similarity', 'Basic Proportionality Theorem']],
    ['Coordinate Geometry', 'coord', ['Distance Formula', 'Section Formula']],
    ['Introduction to Trigonometry', 'trig', ['Trigonometric Ratios', 'Trigonometric Ratios of Specific Angles', 'Trigonometric Identities']],
    ['Some Applications of Trigonometry', 'trig', ['Heights and Distances']],
    ['Circles', 'circles', ['Tangent to a Circle', 'Number of Tangents from a Point']],
    ['Areas Related to Circles', 'mensuration', ['Area of Sector and Segment', 'Areas of Combinations of Figures']],
    ['Surface Areas and Volumes', 'mensuration', ['Surface Area of Combined Solids', 'Volume of Combined Solids']],
    ['Statistics', 'data', ['Mean of Grouped Data', 'Mode of Grouped Data', 'Median of Grouped Data']],
    ['Probability', 'probability', ['Theoretical Probability', 'Simple Problems on Probability']],
  ],
};

const FAMILY_CODE = {
  numbers: 'NUM', integers: 'INT', fractions: 'FRA', decimals: 'DEC', data: 'DAT', mensuration: 'MEN',
  linear: 'ALG', ratio: 'RAT', angles: 'GEO', percent: 'PER', algebra: 'EXP', exponents: 'POW',
  polygons: 'QUA', probability: 'PRB', squares: 'SQR', cubes: 'CUB', coord: 'CRD', poly: 'POL',
  circles: 'CIR', heron: 'HER', quadratic: 'QDR', ap: 'APR', trig: 'TRG',
};

function build() {
  const classes = {};
  Object.entries(RAW).forEach(([cls, chapters]) => {
    classes[cls] = chapters.map(([name, family, topics], ci) => {
      const chapterId = `c${cls}_ch${String(ci + 1).padStart(2, '0')}`;
      return {
        id: chapterId,
        classId: Number(cls),
        boardId: 'NCERT_CBSE',
        subjectId: 'MATHS',
        number: ci + 1,
        name,
        family,
        code: FAMILY_CODE[family],
        status: 'PUBLISHED',
        topics: topics.map((tName, ti) => ({
          id: `${chapterId}_t${ti + 1}`,
          chapterId,
          classId: Number(cls),
          number: ti + 1,
          name: tName,
          family,
          status: 'PUBLISHED',
        })),
      };
    });
  });
  return classes;
}

export const CURRICULUM = build();

const TOPIC_INDEX = {};
const CHAPTER_INDEX = {};
Object.values(CURRICULUM).forEach((chapters) => chapters.forEach((ch) => {
  CHAPTER_INDEX[ch.id] = ch;
  ch.topics.forEach((t) => { TOPIC_INDEX[t.id] = { ...t, chapterName: ch.name, code: ch.code }; });
}));

export const getTopic = (topicId) => TOPIC_INDEX[topicId] || null;
export const getChapter = (chapterId) => CHAPTER_INDEX[chapterId] || null;
export const allTopics = (classId) => (CURRICULUM[classId] || []).flatMap((ch) => ch.topics.map((t) => TOPIC_INDEX[t.id]));
