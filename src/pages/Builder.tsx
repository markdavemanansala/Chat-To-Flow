// @ts-nocheck
import BuilderShell from '@/components/builder/BuilderShell'

interface BuilderProps {
  initialTab?: 'chat' | 'catalog'
}

export default function Builder(props: BuilderProps = {}) {
  return <BuilderShell initialTab={props.initialTab} />
}
