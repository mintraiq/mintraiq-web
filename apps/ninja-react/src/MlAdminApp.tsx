import { useQuery } from '@tanstack/react-query';
import { fetchMlAdminAccess } from './api/mlAdmin';
import { MlModelRegistryPanel } from './components/MlModelRegistryPanel';

/**
 * MintrAdminAgent-only ML operations console.
 * Mounted via data-ninja-page="ml-admin" on portal/ml-admin.html.
 */
export function MlAdminApp(): JSX.Element {
    const access = useQuery({
        queryKey: ['ml-admin-access'],
        queryFn: fetchMlAdminAccess,
        retry: false
    });

    if (access.isPending) {
        return <div className="card" style={{ padding: 24 }}>Checking admin access…</div>;
    }

    if (access.isError || !access.data?.allowed) {
        const roles = access.data?.required_roles?.join(', ') || 'MintrAdminAgent';
        return (
            <div className="card" style={{ padding: 24, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Access denied</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                    This page requires the Logto role <code>{roles}</code>. Assign it to your user in Logto
                    Console → Roles, then sign out and back in.
                </p>
            </div>
        );
    }

    return <MlModelRegistryPanel />;
}
