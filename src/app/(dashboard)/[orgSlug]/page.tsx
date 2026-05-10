export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div className="p-8">
      <h1 className="font-display text-4xl text-gold">{orgSlug.toUpperCase()}</h1>
      <p className="text-muted-foreground mt-2">Dashboard — Session 3.2</p>
    </div>
  )
}
