// The only Sentry functions the app uses. monitoring.js loads this module on
// demand; importing named functions (rather than the whole '@sentry/react'
// namespace) lets the bundler drop unused parts such as session replay,
// user feedback and performance tracing.
export { init, captureException, setUser } from '@sentry/react'
