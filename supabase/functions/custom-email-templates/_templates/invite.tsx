import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface InviteEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const InviteEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: InviteEmailProps) => (
  <Html>
    <Head />
    <Preview>Você foi convidado para o SanarFlix Academy</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Heading style={h1}>🎓 SanarFlix Academy</Heading>
        </Section>
        
        <Section style={contentSection}>
          <Heading style={h2}>Bem-vindo(a)!</Heading>
          <Text style={text}>
            Você foi convidado(a) para acessar o <strong>SanarFlix Academy</strong>, 
            a plataforma exclusiva de estudos da sua universidade parceira.
          </Text>
          <Text style={text}>
            Para começar, clique no botão abaixo e defina sua senha de acesso:
          </Text>
          
          <Section style={buttonSection}>
            <Button
              style={button}
              href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
            >
              Definir minha senha
            </Button>
          </Section>
          
          <Text style={textSmall}>
            Ou copie e cole este link no seu navegador:
          </Text>
          <Text style={linkText}>
            {`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          </Text>
          
          <Hr style={hr} />
          
          <Text style={textMuted}>
            ⚠️ Este link é válido por 24 horas. Se expirar, solicite um novo convite 
            ao administrador da sua instituição.
          </Text>
        </Section>
        
        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} SanarFlix Academy - Sanar Educação
          </Text>
          <Text style={footerText}>
            Este é um email automático, não responda.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
}

const logoSection = {
  backgroundColor: '#800000',
  padding: '30px 40px',
  textAlign: 'center' as const,
}

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
}

const contentSection = {
  padding: '40px',
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 20px 0',
}

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px 0',
}

const textSmall = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '20px 0 8px 0',
}

const linkText = {
  color: '#800000',
  fontSize: '12px',
  lineHeight: '20px',
  wordBreak: 'break-all' as const,
  margin: '0 0 20px 0',
}

const textMuted = {
  color: '#888888',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '20px 0 0 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '30px 0',
}

const button = {
  backgroundColor: '#800000',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 40px',
}

const hr = {
  borderColor: '#e6e6e6',
  margin: '30px 0',
}

const footer = {
  backgroundColor: '#f6f9fc',
  padding: '20px 40px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#999999',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '4px 0',
}
