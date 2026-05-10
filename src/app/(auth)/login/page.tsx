'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { GoldDivider } from '@/components/mpl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'

export default function LoginPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: LoginInput) {
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })
    if (error) { toast.error(error.message); return }
    setSentEmail(email)
    setSent(true)
  }

  async function handleGoogle() {
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    })
    if (error) toast.error(error.message)
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="font-display text-6xl text-gold-gradient uppercase tracking-widest">
          PadelOS
        </h1>
        <GoldDivider withDiamond className="my-4" />
        <p className="font-body text-xs text-muted-foreground tracking-[0.3em] uppercase">
          Mauritius Padel League
        </p>
      </div>

      <div className="rounded-xl border border-border bg-court-card p-8 space-y-6">
        {sent ? (
          <ConfirmationCard email={sentEmail} onBack={() => setSent(false)} />
        ) : (
          <>
            <div>
              <h2 className="font-display text-2xl text-foreground tracking-wide">Connexion</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Recevez un lien magique par email — aucun mot de passe requis
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="vous@exemple.com"
                          autoComplete="email"
                          className="bg-court border-border focus-visible:ring-gold/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {form.formState.isSubmitting ? 'Envoi en cours…' : 'Recevoir mon lien'}
                </Button>
              </form>
            </Form>

            {/* Separator */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs uppercase text-muted-foreground tracking-widest">ou</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={handleGoogle}
              className="w-full gap-2 border-border"
            >
              <GoogleIcon />
              Continuer avec Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-gold hover:text-gold-light underline underline-offset-4 transition-colors">
                Créer un compte
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfirmationCard({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
        <Mail className="w-6 h-6 text-gold" />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-xl text-foreground tracking-wide">
          Vérifiez vos emails
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Un lien de connexion a été envoyé à{' '}
          <span className="text-foreground font-medium">{email}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Vérifiez vos spams si vous ne le recevez pas sous 2 minutes.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        ← Utiliser une autre adresse
      </Button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
