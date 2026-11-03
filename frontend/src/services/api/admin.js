import { isMockMode } from '../http';
import * as mock from './adminMock';
import * as real from './real/admin';

/** Admin console API. Real backend by default; mock only when VITE_USE_MOCK_API=true. */
export const { adminApi } = isMockMode() ? mock : real;
