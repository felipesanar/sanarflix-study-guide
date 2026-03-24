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

interface MagicLinkEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const MagicLinkEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: MagicLinkEmailProps) => (
  <Html>
    <Head />
    <Preview>Acesse sua conta Sanarflix Academy com um clique</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://academy.sanar.com.br/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
            width="48"
            height="48"
            alt="Sanarflix"
            style={logo}
          />
          <Section>
            <Text style={brandName}>Sanarflix Academy</Text>
            <Text style={brandTagline}>Sua Plataforma de Estudos</Text>
          </Section>
        </Section>

        <Heading style={h1}>Acesse sua conta</Heading>

        <Text style={text}>
          Clique no botão abaixo para fazer login automático em sua conta Sanarflix:
        </Text>

        <Section style={buttonContainer}>
          <Link
            href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to || 'https://academy.sanar.com.br/'}`}
            style={button}
          >
            Acessar Sanarflix
          </Link>
        </Section>

        <Text style={alternativeText}>
          Ou copie e cole este código temporário:
        </Text>
        <code style={code}>{token}</code>

        <Hr style={hr} />

        <Text style={footerText}>
          Se você não tentou fazer login, pode ignorar este email com segurança.
        </Text>

        <Text style={footer}>
          <Link
            href="https://sanar.com"
            target="_blank"
            style={footerLink}
          >
            Sanar Educação
          </Link>
          <br />
          Transformando a educação médica no Brasil
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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

const code = {
  display: 'inline-block',
  padding: '16px 24px',
  width: 'calc(100% - 40px)',
  margin: '0 20px',
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  color: '#1f2937',
  fontSize: '16px',
  fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
  textAlign: 'center' as const,
  letterSpacing: '2px',
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