import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ThemeProvider } from './theme/ThemeContext';
import { router } from './routes';
import { NotificationStream } from './realtime/NotificationStream';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // 401s are handled entirely by the api/client.ts interceptor
      // (refresh-and-retry, or session-expired event) — React
      // Query's own retry must not re-attempt a request that's
      // already been through that flow and still failed.
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          {/* Mounted here, beside the router rather than inside any
              page layout, so the live connection opens once at login
              and survives every page navigation. Navigation from a
              toast goes through the router instance directly. */}
          <NotificationStream onOpen={(path) => void router.navigate(path)} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
