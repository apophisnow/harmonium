import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-th-bg-secondary group-[.toaster]:text-th-text-primary group-[.toaster]:border-th-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-th-text-secondary",
          actionButton:
            "group-[.toast]:bg-th-brand group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-th-bg-accent group-[.toast]:text-th-text-secondary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
