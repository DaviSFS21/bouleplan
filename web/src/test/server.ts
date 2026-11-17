import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Quiet defaults for the planner reads every task screen makes; planner tests override them.
export const server = setupServer(
  http.get('*/api/planner', ({ request }) =>
    HttpResponse.json({
      weekStart: new URL(request.url).searchParams.get('weekStart'),
      events: [],
      items: [],
    }),
  ),
  http.get('*/api/tasks/:id/scheduled-items', () => HttpResponse.json([])),
);
