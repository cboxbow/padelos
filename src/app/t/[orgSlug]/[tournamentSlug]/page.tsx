export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>
}) {
  const { orgSlug, tournamentSlug } = await params

  return (
    <div className="p-8">
      <p className="text-muted-foreground">
        Public portal: {orgSlug}/{tournamentSlug} — Session 7.1
      </p>
    </div>
  )
}
