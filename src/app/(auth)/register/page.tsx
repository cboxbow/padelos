'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  registerStep1Schema, registerStep2Schema, toSlug,
  type RegisterStep1Input, type RegisterStep2Input,
} from '@/lib/validations/auth'
import { GoldDivider } from '@/components/mpl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STEPS = ['Votre profil', 'Organisation', 'Confirmation'] as const

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [sent, setSent] = useState(false)

  const form1 = useForm<RegisterStep1Input>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: { email: '', first_name: '', last_name: '' },
  })

  const form2 = useForm<RegisterStep2Input>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { org_name: '', org_type: 'club', org_slug: '' },
  })

  async function handleStep2Submit(data: RegisterStep2Input) {
    const { email, first_name, last_name } = form1.getValues()
    const supabase = createClient()
    const origin = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?flow=register`,
        data: {
          first_name,
          last_name,
          display_name: `${first_name} ${last_name}`,
          org_name:  data.org_name,
          org_type:  data.org_type,
          org_slug:  data.org_slug,
        },
      },
    })
    if (error) { toast.error(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <AuthHeader />
        <div className="rounded-xl border border-border bg-court-card p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Mail className="w-6 h-6 text-gold" />
          </div>
          <h3 className="font-display text-xl text-foreground tracking-wide">Vérifiez vos emails</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un lien d&apos;activation a été envoyé à{' '}
            <span className="text-foreground font-medium">{form1.getValues().email}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Cliquez sur le lien pour créer votre organisation et accéder à la plateforme.
          </p>
          <Link href="/login" className="block text-sm text-gold hover:text-gold-light underline underline-offset-4 transition-colors">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <AuthHeader />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = n === step
          const done   = n < step
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors
                ${done   ? 'bg-gold text-black'
                : active ? 'border-2 border-gold text-gold'
                :          'border border-border text-muted-foreground'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-[10px] uppercase tracking-wider hidden sm:block ${active ? 'text-gold' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-court-card p-8 space-y-6">
        {/* ── Step 1 : Profil ───────────────────────────────────────── */}
        {step === 1 && (
          <Form {...form1}>
            <form onSubmit={form1.handleSubmit(() => setStep(2))} className="space-y-4">
              <h2 className="font-display text-2xl text-foreground tracking-wide">Votre profil</h2>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form1.control} name="first_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl><Input placeholder="Jean" className="bg-court border-border" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form1.control} name="last_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl><Input placeholder="Dupont" className="bg-court border-border" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form1.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vous@exemple.com" autoComplete="email"
                      className="bg-court border-border focus-visible:ring-gold/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase">
                Suivant →
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ?{' '}
                <Link href="/login" className="text-gold hover:text-gold-light underline underline-offset-4">Se connecter</Link>
              </p>
            </form>
          </Form>
        )}

        {/* ── Step 2 : Organisation ─────────────────────────────────── */}
        {step === 2 && (
          <Form {...form2}>
            <form onSubmit={form2.handleSubmit(handleStep2Submit)} className="space-y-4">
              <h2 className="font-display text-2xl text-foreground tracking-wide">Votre organisation</h2>
              <FormField control={form2.control} name="org_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l&apos;organisation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Mauritius Padel League"
                      className="bg-court border-border"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        if (!form2.formState.dirtyFields.org_slug) {
                          form2.setValue('org_slug', toSlug(e.target.value), { shouldValidate: false })
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form2.control} name="org_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-court border-border">
                        <SelectValue placeholder="Sélectionnez…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-court-card border-border">
                      <SelectItem value="federation">Fédération nationale</SelectItem>
                      <SelectItem value="club">Club</SelectItem>
                      <SelectItem value="association">Association</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form2.control} name="org_slug" render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifiant URL</FormLabel>
                  <FormControl>
                    <div className="flex items-center rounded-md border border-border bg-court overflow-hidden">
                      <span className="px-3 text-xs text-muted-foreground border-r border-border bg-court-panel h-9 flex items-center">
                        padelos.mu/
                      </span>
                      <Input
                        placeholder="mon-club"
                        className="border-0 bg-transparent focus-visible:ring-0 rounded-none"
                        {...field}
                        onChange={(e) => field.onChange(toSlug(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => setStep(1)}>
                  ← Retour
                </Button>
                <Button type="submit" disabled={form2.formState.isSubmitting}
                  className="flex-1 bg-gold text-black hover:bg-gold-light font-semibold tracking-wider uppercase">
                  {form2.formState.isSubmitting ? 'Envoi…' : 'Créer mon compte'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  )
}

function AuthHeader() {
  return (
    <div className="text-center mb-8">
      <h1 className="font-display text-6xl text-gold-gradient uppercase tracking-widest">PadelOS</h1>
      <GoldDivider withDiamond className="my-4" />
      <p className="font-body text-xs text-muted-foreground tracking-[0.3em] uppercase">Mauritius Padel League</p>
    </div>
  )
}
