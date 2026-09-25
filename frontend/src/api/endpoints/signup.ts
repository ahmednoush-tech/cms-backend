import { apiRequest } from '../client';
import type { SignupInput, SignupResult } from '../../types/entities/signup';

/** Confirmed 1:1 against backend/src/modules/signup/signup.controller.ts. */
export const signupApi = {
  signup: async (input: SignupInput): Promise<SignupResult> => {
    const { data } = await apiRequest<SignupResult>({ method: 'POST', url: '/signup', data: input });
    return data;
  },
};
