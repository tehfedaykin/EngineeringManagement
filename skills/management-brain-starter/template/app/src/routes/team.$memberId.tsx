import { createFileRoute } from '@tanstack/react-router';
import { TeamMemberPage } from '../components/TeamMemberPage';
import { fetchTeamMember } from '../lib/team';

export const Route = createFileRoute('/team/$memberId')({
  loader: ({ params }) => fetchTeamMember(params.memberId),
  errorComponent: () => <p className="muted">That team member couldn't be loaded.</p>,
  component: MemberRoute,
});

function MemberRoute() {
  const member = Route.useLoaderData();
  // Keyed so switching people resets the page's local edit state.
  return <TeamMemberPage key={member.id} initial={member} />;
}
