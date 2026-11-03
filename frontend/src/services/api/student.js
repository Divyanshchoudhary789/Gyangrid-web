import { isMockMode } from '../http';
import * as mock from './studentMock';
import * as real from './real/student';

/**
 * Student API surface. Components import only from here.
 * Real backend by default; the in-browser mock is used only when VITE_USE_MOCK_API=true (local demo).
 */
const impl = isMockMode() ? mock : real;

export const {
  authApi, homeApi, learnApi, challengeApi, practiceApi, testApi, doubtApi, mistakeApi, progressApi, accountApi, curriculumApi,
} = impl;
