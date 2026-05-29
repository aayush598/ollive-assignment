"use client";

import Link from "next/link";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-semibold text-lg">LLM Inference Logger</span>
          </div>
          <div className="flex items-center gap-4">
            {!isLoaded ? (
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            ) : isSignedIn ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/chat"
                  className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton />
              </div>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              LLM Inference <span className="text-blue-600">Logging & Ingestion</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A production-ready system for logging, monitoring, and analyzing LLM inference
              metadata. Built with Next.js, TypeScript, and modern best practices.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              {isSignedIn ? (
                <Link
                  href="/chat"
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <SignUpButton mode="modal">
                    <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      Start Chatting
                    </button>
                  </SignUpButton>
                  <SignInButton mode="modal">
                    <button className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 bg-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">Key Features</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Multi-Provider Chat</h3>
                <p className="text-gray-600">
                  Chat with GPT-4.1, Claude Sonnet, Gemini, DeepSeek, and Grok through a unified
                  interface.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Inference Logging</h3>
                <p className="text-gray-600">
                  Capture latency, token usage, errors and metadata from every LLM inference
                  request.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">PII Redaction</h3>
                <p className="text-gray-600">
                  Automatic detection and redaction of emails, phone numbers, SSNs, and other PII
                  from logs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
