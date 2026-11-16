import { createFileRoute } from '@tanstack/react-router';
import { TodoList } from '../components/TodoList';
import { loadTodoData } from '../lib/api';

export const Route = createFileRoute('/todos')({
  loader: loadTodoData,
  component: TodosPage,
});

function TodosPage() {
  const { commitments, matrix } = Route.useLoaderData();
  return <TodoList commitments={commitments} initialState={matrix} />;
}
