import AppShell from '../components/app-shell'
import Recapitulatif from '../components/recapitulatif'
import Toaster from '../components/toaster'

export default function RecapitulatifPage() {
  return (
    <AppShell>
      <Recapitulatif />
      <Toaster />
    </AppShell>
  )
}
