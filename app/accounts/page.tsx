import { AccountsPageContent } from '@/components/accounts/AccountsPageContent'

export default function AccountsPage() {
  return (
    <AccountsPageContent
      appId={process.env.TELLER_APPLICATION_ID ?? ''}
      environment={process.env.TELLER_ENVIRONMENT ?? 'development'}
    />
  )
}
