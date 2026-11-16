import { createFileRoute } from '@tanstack/react-router';
import { EisenhowerMatrix } from '../components/EisenhowerMatrix';
import { loadTodoData } from '../lib/api';

export const Route = createFileRoute('/')({
  loader: loadTodoData,
  component: MatrixPage,
});

function MatrixPage() {
  const { commitments, matrix } = Route.useLoaderData();
  return <EisenhowerMatrix commitments={commitments} initialState={matrix} />;
}
