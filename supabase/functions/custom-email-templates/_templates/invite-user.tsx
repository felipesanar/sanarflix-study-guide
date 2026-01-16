import {
    Body, Container, Head, Heading, Html, Link, Preview, Text, Img, Section, Hr,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface InviteUserEmailProps {
    supabase_url: string
    email_action_type: string
    redirect_to: string
    token_hash: string
    token: string
}

export const InviteUserEmail = ({ ... }) => (
    <Html>
        <Head />
        <Preview>Você foi convidado para o SanarFlix Academy</Preview>
        <Body style={main}>
            <Container style={container}>
                {/* Logo Section */}
                <Section style={logoSection}>
                    <Img src="..." width="48" height="48" alt="SanarFlix Academy" style={logo} />
                    <div>
                        <Text style={brandName}>SanarFlix Academy</Text>
                        <Text style={brandTagline}>Sua plataforma de estudos</Text>
                    </div>
                </Section>

                {/* Título */}
                <Heading style={h1}>Bem-vindo ao SanarFlix Academy!</Heading>

                {/* Texto explicativo */}
                <Text style={text}>
                    Você foi convidado para acessar a plataforma de estudos da sua universidade.
                </Text>
                <Text style={text}>
                    Para garantir sua segurança e liberar seu acesso, clique no botão abaixo
                    e <strong>defina sua senha pessoal</strong>.
                </Text>

                {/* CTA */}
                <Section style={buttonContainer}>
                    <Link href={confirmationUrl} style={button}>
                        Definir minha senha
                    </Link>
                </Section>

                {/* Link alternativo */}
                <Text style={alternativeText}>
                    Se o botão não funcionar, copie e cole este link no navegador:
                </Text>
                <Text style={linkText}>{confirmationUrl}</Text>

                <Hr style={hr} />

                {/* Footer */}
                <Text style={footerText}>
                    Você recebeu este e-mail porque foi cadastrado na plataforma pela sua instituição de ensino.
                </Text>
                <Text style={footer}>
                    <Link href="https://sanar.com" style={footerLink}>Sanar Educação</Link>
                    <br />
                    Transformando a educação médica no Brasil
                </Text>
            </Container>
        </Body>
    </Html>
)
