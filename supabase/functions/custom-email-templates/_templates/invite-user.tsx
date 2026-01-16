import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Text,
    Img,
    Section,
    Hr,
} from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1,react-dom@18.3.1'
import * as React from 'https://esm.sh/react@18.3.1'

interface InviteUserEmailProps {
    supabase_url: string
    email_action_type: string
    redirect_to: string
    token_hash: string
    token: string
}

export const InviteUserEmail = ({
    token,
    supabase_url,
    email_action_type,
    redirect_to,
    token_hash,
}: InviteUserEmailProps) => {
    const confirmationUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to || 'https://sanarflix-study-guide.lovable.app/auth/update-password'}`

    return (
        <Html>
            <Head />
            <Preview>Você foi convidado para o SanarFlix Academy</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={logoSection}>
                        <Img
                            src="https://sanarflix-study-guide.lovable.app/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                            width="48"
                            height="48"
                            alt="SanarFlix Academy"
                            style={logo}
                        />
                        <Section>
                            <Text style={brandName}>SanarFlix Academy</Text>
                            <Text style={brandTagline}>Sua plataforma de estudos</Text>
                        </Section>
                    </Section>

                    <Heading style={h1}>Bem-vindo ao SanarFlix Academy!</Heading>

                    <Text style={text}>
                        Você foi convidado para acessar a plataforma de estudos da sua universidade.
                    </Text>
                    <Text style={text}>
                        Para garantir sua segurança e liberar seu acesso, clique no botão abaixo
                        e <strong>defina sua senha pessoal</strong>.
                    </Text>

                    <Section style={buttonContainer}>
                        <Link href={confirmationUrl} style={button}>
                            Definir minha senha
                        </Link>
                    </Section>

                    <Text style={alternativeText}>
                        Se o botão não funcionar, copie e cole este link no navegador:
                    </Text>
                    <Text style={linkText}>{confirmationUrl}</Text>

                    <Hr style={hr} />

                    <Text style={footerText}>
                        Você recebeu este e-mail porque foi cadastrado na plataforma pela sua instituição de ensino.
                    </Text>
                    <Text style={footer}>
                        <Link href="https://sanar.com" target="_blank" style={footerLink}>
                            Sanar Educação
                        </Link>
                        <br />
                        Transformando a educação médica no Brasil
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}

export default InviteUserEmail

const main = {
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
    maxWidth: '560px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
}

const logoSection = {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '20px',
    marginBottom: '32px',
}

const logo = {
    borderRadius: '8px',
    marginRight: '12px',
}

const brandName = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0',
    lineHeight: '28px',
}

const brandTagline = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0',
    lineHeight: '20px',
}

const h1 = {
    color: '#1f2937',
    fontSize: '28px',
    fontWeight: '700',
    margin: '32px 20px 24px',
    padding: '0',
    lineHeight: '32px',
}

const text = {
    color: '#374151',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '16px 20px',
}

const buttonContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
}

const button = {
    backgroundColor: '#8B1538',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '12px 32px',
    lineHeight: '24px',
    boxShadow: '0 4px 6px -1px rgba(139, 21, 56, 0.1), 0 2px 4px -1px rgba(139, 21, 56, 0.06)',
}

const alternativeText = {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '24px 20px 12px',
    textAlign: 'center' as const,
}

const linkText = {
    color: '#8B1538',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '0 20px 24px',
    textAlign: 'center' as const,
    wordBreak: 'break-all' as const,
}

const hr = {
    borderColor: '#e5e7eb',
    margin: '32px 20px',
}

const footerText = {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '16px 20px',
    textAlign: 'center' as const,
}

const footer = {
    color: '#9ca3af',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '32px 20px 20px',
    textAlign: 'center' as const,
}

const footerLink = {
    color: '#8B1538',
    textDecoration: 'none',
    fontWeight: '600',
}
