type Runway = {
  element: HTMLElement;
  stage: HTMLElement;
  kind: string;
  progress: number;
};

export function startSceneMotion(page: HTMLElement) {
  const controller = new AbortController();
  const signal = controller.signal;
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (value: number, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));
  const all = <T extends Element = HTMLElement>(selector: string) =>
    Array.from(page.querySelectorAll<T>(selector));
  const runs: Runway[] = all<HTMLElement>("[data-pin]").map((element) => ({
    element,
    stage: element.firstElementChild as HTMLElement,
    kind: element.dataset.pin || "",
    progress: 0,
  }));
  const heroRun = runs.find((run) => run.kind === "hero");
  const programRun = runs.find((run) => run.kind === "program");
  const rig = page.querySelector<HTMLElement>("[data-rig]");
  const heroCopy = page.querySelector<HTMLElement>(".hero-copy");
  const panels = all<HTMLElement>(".sp");
  const buttons = all<HTMLElement>(".tk");
  const steps = all<SVGElement>(".nd");
  const hop = page.querySelector<SVGElement>("#hop");
  const hopBody = page.querySelector<SVGElement>("#hopb");
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;
  let hopPosition = 0;
  let hoverStep: number | null = null;
  let activeStep = -1;

  function setStep(step: number) {
    if (step === activeStep) return;
    activeStep = step;
    [panels, buttons, steps].forEach((group) =>
      group.forEach((element, index) => {
        element.setAttribute(
          "data-state",
          index < step ? "past" : index === step ? "now" : "next",
        );
      }),
    );
    buttons.forEach((button, index) =>
      button.setAttribute("aria-pressed", String(index === step)),
    );
    panels.forEach((panel, index) =>
      panel.setAttribute("aria-hidden", String(index !== step)),
    );
  }

  function requestFrame() {
    if (!frame && !document.hidden && !preference.matches)
      frame = requestAnimationFrame(render);
  }

  function render() {
    frame = 0;
    if (preference.matches || document.hidden) return;
    let settling = false;

    // Scroll keeps the original camera-and-paper sequence, with a short easing tail.
    for (const run of runs) {
      const travel = Math.max(
        1,
        run.element.offsetHeight - run.stage.offsetHeight,
      );
      const target = clamp(-run.element.getBoundingClientRect().top / travel);
      run.progress += (target - run.progress) * 0.16;
      if (Math.abs(target - run.progress) < 0.0005) run.progress = target;
      else settling = true;
      run.element.style.setProperty(
        run.kind === "hero" ? "--hp" : "--sp",
        run.progress.toFixed(4),
      );
    }

    if (heroRun && rig) {
      easedX += (pointerX - easedX) * 0.09;
      easedY += (pointerY - easedY) * 0.09;
      if (Math.abs(pointerX - easedX) + Math.abs(pointerY - easedY) > 0.001)
        settling = true;
      const position = clamp(heroRun.progress / 0.52);
      const eased = position * position * (3 - 2 * position);
      const ratio = window.innerWidth <= 760 ? 0.88 : 1.9857;
      const unit =
        Math.max(
          heroRun.stage.clientWidth,
          heroRun.stage.clientHeight * ratio,
        ) / 1672;
      const tilt = 36 * (1 - eased) - easedY * 2.1 * (1 - eased * 0.7);
      const turn = 13 * eased + easedX * 2.4 * (1 - eased * 0.85);
      rig.style.transform = `translate3d(${-easedX * 20 * unit * (1 - eased)}px,${-easedY * 12 * unit * (1 - eased)}px,${1010 * unit * eased}px) rotateX(${tilt}deg) rotateZ(${turn}deg)`;
      if (heroCopy) heroCopy.inert = heroRun.progress > 0.25;
    }

    if (programRun && hop && hopBody) {
      const scrollPosition = clamp((programRun.progress - 0.1) / 0.62) * 3;
      const destination = hoverStep ?? scrollPosition;
      setStep(hoverStep ?? Math.round(scrollPosition));
      hopPosition += (destination - hopPosition) * 0.16;
      if (Math.abs(destination - hopPosition) < 0.001)
        hopPosition = destination;
      else settling = true;
      const index = Math.min(2, Math.max(0, Math.floor(hopPosition)));
      const fraction = clamp(hopPosition - index);
      const ease = fraction * fraction * (3 - 2 * fraction);
      const air = Math.sin(Math.PI * fraction) * 64;
      const x = [60, 192, 324][index] + 132 * ease;
      const y = [360, 278, 196][index] - 82 * ease - 26 - air;
      hop.setAttribute(
        "transform",
        `translate(${x.toFixed(2)} ${y.toFixed(2)})`,
      );
      hopBody.setAttribute("transform", `scale(1 ${1 + air / 400})`);
    }

    // Once the scene settles, it stops rendering until the next input.
    if (settling) requestFrame();
  }

  function updateMotionPreference() {
    page.classList.toggle("motion-ready", !preference.matches);
    if (preference.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      if (heroCopy) heroCopy.inert = false;
      panels.forEach((panel) => panel.removeAttribute("aria-hidden"));
      buttons.forEach((button) => button.removeAttribute("aria-pressed"));
    } else {
      activeStep = -1;
      requestFrame();
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -24px 0px" },
  );
  all(".rv, .wr, .rvimg, .rl, .fm").forEach((element) =>
    observer.observe(element),
  );

  heroRun?.stage.addEventListener(
    "pointermove",
    (event) => {
      if (!finePointer.matches || preference.matches) return;
      const rect = heroRun.stage.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      requestFrame();
    },
    { signal },
  );
  heroRun?.stage.addEventListener(
    "pointerleave",
    () => {
      pointerX = pointerY = 0;
      requestFrame();
    },
    { signal },
  );

  function goToStep(index: number) {
    if (!programRun || preference.matches) return;
    hoverStep = null;
    const top = programRun.element.getBoundingClientRect().top + window.scrollY;
    const travel =
      programRun.element.offsetHeight - programRun.stage.offsetHeight;
    window.scrollTo({
      top: top + (0.1 + (0.62 * index) / 3 + 0.002) * travel,
      behavior: "smooth",
    });
    requestFrame();
  }

  all<HTMLElement>("[data-go]").forEach((element) => {
    const index = Number(element.dataset.go);
    element.addEventListener("click", () => goToStep(index), { signal });
    if (element.tagName.toLowerCase() !== "button") {
      element.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goToStep(index);
          }
        },
        { signal },
      );
    }
  });
  steps.forEach((element, index) => {
    element.addEventListener(
      "pointerenter",
      () => {
        if (!finePointer.matches) return;
        hoverStep = index;
        requestFrame();
      },
      { signal },
    );
    element.addEventListener(
      "pointerleave",
      () => {
        hoverStep = null;
        requestFrame();
      },
      { signal },
    );
  });

  all<HTMLAnchorElement>(".mobile-menu a").forEach((link) => {
    link.addEventListener(
      "click",
      () => {
        const menu = link.closest("details");
        if (menu) menu.open = false;
      },
      { signal },
    );
  });
  page.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        const menu =
          page.querySelector<HTMLDetailsElement>(".mobile-menu[open]");
        if (menu) {
          menu.open = false;
          menu.querySelector("summary")?.focus();
        }
      }
    },
    { signal },
  );
  window.addEventListener("scroll", requestFrame, { passive: true, signal });
  window.addEventListener("resize", requestFrame, { passive: true, signal });
  document.addEventListener("visibilitychange", requestFrame, { signal });
  preference.addEventListener("change", updateMotionPreference, { signal });
  updateMotionPreference();

  return () => {
    controller.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    page.classList.remove("motion-ready");
  };
}
