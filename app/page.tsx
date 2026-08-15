import AppShell from './components/app-shell'
import FicheForm from './components/fiche-form'
import Toaster from './components/toaster'

export default function HomePage() {
  return (
    <AppShell>
      <FicheForm />
      <Toaster />
    </AppShell>
  )
}
