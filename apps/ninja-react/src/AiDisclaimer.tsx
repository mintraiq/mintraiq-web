/** NZ compliance copy from `.cursor/security.md` */
export function AiDisclaimer(): JSX.Element {
    return (
        <p
            className="ai-disclaimer"
            style={{
                marginTop: 20,
                padding: '12px 14px',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary, #a0a0a0)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.2)'
            }}
        >
            This is AI-generated analysis and does not constitute financial advice under NZ law.
        </p>
    );
}
