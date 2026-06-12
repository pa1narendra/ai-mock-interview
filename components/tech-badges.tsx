const TechBadges = ({ stack, max = 4 }: { stack: string[]; max?: number }) => {
  const shown = stack.slice(0, max);
  const overflow = stack.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((tech) => (
        <span
          key={tech}
          className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-mist-300"
        >
          {tech}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-mist-500">+{overflow}</span>
      )}
    </div>
  );
};

export default TechBadges;
