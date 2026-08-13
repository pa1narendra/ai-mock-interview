const TechBadges = ({ stack, max = 4 }: { stack: string[]; max?: number }) => {
  const shown = stack.slice(0, max);
  const hidden = stack.slice(max);
  const overflow = hidden.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={stack.join(", ")}>
      {shown.map((tech) => (
        <span
          key={tech}
          className="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-text-secondary"
        >
          {tech}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="cursor-default text-xs text-muted-foreground"
          title={hidden.join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};

export default TechBadges;
