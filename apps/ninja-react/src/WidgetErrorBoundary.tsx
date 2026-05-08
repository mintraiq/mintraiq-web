import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

/** Per `.cursor/security.md` — isolate widget failures from the host shell */
export class WidgetErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        if (import.meta.env.DEV) {
            console.error('[ninja-react]', error, info.componentStack);
        }
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="card" style={{ padding: 20, borderColor: 'rgba(255,71,87,0.45)' }}>
                    <strong>This widget could not be displayed.</strong>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        Try refreshing the page. If the problem persists, contact support.
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}
