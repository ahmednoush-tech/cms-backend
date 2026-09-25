import { useMutation } from '@tanstack/react-query';
import { signupApi } from '../endpoints/signup';
import type { SignupInput } from '../../types/entities/signup';

export function useSignup() {
  return useMutation({
    mutationFn: (input: SignupInput) => signupApi.signup(input),
  });
}
