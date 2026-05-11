import { SectionTitle } from '@/components/mpl'
import { getPlayers }   from '@/app/actions/players'
import { PlayersClient } from './_components/PlayersClient'

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const players     = await getPlayers(orgSlug)

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Joueurs"
        subtitle={`${players.length} joueur${players.length !== 1 ? 's' : ''} dans le roster`}
        withAccent
        as="h1"
      />
      <PlayersClient orgSlug={orgSlug} initialPlayers={players} />
    </div>
  )
}
