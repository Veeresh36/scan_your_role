import { SITE_NAME } from "./site";

const GRAD =
    "linear-gradient(135deg,var(--brand),var(--brand2))";

/* =========================================================
   BRAND MARK
========================================================= */

export function BrandMark({
    size = 46,
    className = "",
}) {
    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
            }}
            className={`
                relative
                inline-flex
                flex-none
                items-center
                justify-center
                ${className}
            `}
        >
            {/* Main logo */}
            <span
                className="
                    logo-mark
                    relative
                    z-10
                    flex
                    h-full
                    w-full
                    origin-center
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[28%]
                "
            >
                <img
                    src="/favicon.png"
                    alt=""
                    width={size}
                    height={size}
                    draggable="false"
                    className="
                        relative
                        z-20
                        h-full
                        w-full
                        select-none
                        object-contain
                    "
                />

                {/* Light sweep */}
                <span
                    className="
                        logo-sweep
                        pointer-events-none
                        absolute
                        inset-y-[-40%]
                        left-[-80%]
                        z-30
                        w-[28%]
                        rotate-[20deg]
                        bg-gradient-to-r
                        from-transparent
                        via-white/90
                        to-transparent
                        opacity-0
                        blur-[1px]
                    "
                />
            </span>

            {/* Particle 1 */}
            <span
                className="
                    logo-particle
                    particle-one
                    pointer-events-none
                    absolute
                    left-[7%]
                    top-[15%]
                    h-[3px]
                    w-[3px]
                    rounded-full
                    bg-[var(--brand)]
                    opacity-0
                "
            />

            {/* Particle 2 */}
            <span
                className="
                    logo-particle
                    particle-two
                    pointer-events-none
                    absolute
                    right-[7%]
                    top-[25%]
                    h-[2px]
                    w-[2px]
                    rounded-full
                    bg-[var(--brand2)]
                    opacity-0
                "
            />

            {/* Particle 3 */}
            <span
                className="
                    logo-particle
                    particle-three
                    pointer-events-none
                    absolute
                    bottom-[12%]
                    right-[16%]
                    h-[3px]
                    w-[3px]
                    rounded-full
                    bg-[var(--brand)]
                    opacity-0
                "
            />

            {/* Particle 4 */}
            <span
                className="
                    logo-particle
                    particle-four
                    pointer-events-none
                    absolute
                    bottom-[8%]
                    left-[16%]
                    h-[2px]
                    w-[2px]
                    rounded-full
                    bg-[var(--brand2)]
                    opacity-0
                "
            />
        </span>
    );
}


/* =========================================================
   WORDMARK
========================================================= */

export function Wordmark({
    className = "text-[22px]",
}) {
    const words = SITE_NAME.split(" ");
    const last = words.length - 1;

    return (
        <span
            className={`
                brand-wordmark
                font-extrabold
                leading-none
                tracking-[0.02em]

                transition-all
                duration-700
                ease-[cubic-bezier(.16,1,.3,1)]

                group-hover/logo:tracking-[0.055em]

                ${className}
            `}
        >
            {words.map((word, index) => {
                const key = `${word}-${index}`;

                /* Single word */
                if (words.length < 2) {
                    return (
                        <span
                            key={key}
                            className="
                                text-[var(--ink)]
                                transition-all
                                duration-500
                                group-hover/logo:translate-x-[1px]
                            "
                        >
                            {word}
                        </span>
                    );
                }

                /* First word */
                if (index === 0) {
                    return (
                        <span
                            key={key}
                            className="
                                text-[var(--ink)]
                                transition-all
                                duration-500
                                group-hover/logo:translate-x-[1px]
                            "
                        >
                            {word}{" "}
                        </span>
                    );
                }

                /* Last word */
                if (index === last) {
                    return (
                        <span
                            key={key}
                            className="
                                bg-clip-text
                                text-transparent
                                transition-all
                                duration-700
                                ease-out
                                group-hover/logo:brightness-125
                            "
                            style={{
                                backgroundImage: GRAD,
                                backgroundSize: "200% 100%",
                                backgroundPosition: "0% 50%",
                            }}
                        >
                            {word}
                        </span>
                    );
                }

                /* Middle word */
                return (
                    <span
                        key={key}
                        className="
                            font-medium
                            text-[var(--mute)]
                            transition-colors
                            duration-500
                            group-hover/logo:text-[var(--ink)]
                        "
                    >
                        {word}{" "}
                    </span>
                );
            })}
        </span>
    );
}


/* =========================================================
   COMPLETE LOGO
========================================================= */

export function Logo({
    size = 46,
    text = "text-[22px]",
    className = "",
}) {
    return (
        <span
            className={`
                group/logo
                brand-logo
                inline-flex
                cursor-pointer
                items-center
                gap-3
                ${className}
            `}
        >
            <BrandMark size={size} />

            <Wordmark className={text} />

            <style>
                {`
                    /* =================================================
                       LOGO ROTATION
                    ================================================= */

                    @keyframes logoWelcome {
                        0% {
                            transform: rotate(0deg) scale(1);
                        }

                        18% {
                            transform: rotate(-10deg) scale(1.06);
                        }

                        42% {
                            transform: rotate(8deg) scale(1.09);
                        }

                        62% {
                            transform: rotate(-4deg) scale(1.05);
                        }

                        80% {
                            transform: rotate(2deg) scale(1.02);
                        }

                        100% {
                            transform: rotate(0deg) scale(1);
                        }
                    }


                    /* =================================================
                       LIGHT SWEEP
                    ================================================= */

                    @keyframes logoSweep {
                        0% {
                            left: -80%;
                            opacity: 0;
                        }

                        15% {
                            opacity: 1;
                        }

                        100% {
                            left: 150%;
                            opacity: 0;
                        }
                    }


                    /* =================================================
                       PARTICLE 1
                    ================================================= */

                    @keyframes particleOne {
                        0% {
                            opacity: 0;
                            transform: translate(0, 0) scale(0);
                        }

                        20% {
                            opacity: .9;
                            transform: translate(-4px, -4px) scale(1);
                        }

                        100% {
                            opacity: 0;
                            transform: translate(-12px, -10px) scale(.2);
                        }
                    }


                    /* =================================================
                       PARTICLE 2
                    ================================================= */

                    @keyframes particleTwo {
                        0% {
                            opacity: 0;
                            transform: translate(0, 0) scale(0);
                        }

                        20% {
                            opacity: .8;
                            transform: translate(4px, -3px) scale(1);
                        }

                        100% {
                            opacity: 0;
                            transform: translate(12px, -9px) scale(.2);
                        }
                    }


                    /* =================================================
                       PARTICLE 3
                    ================================================= */

                    @keyframes particleThree {
                        0% {
                            opacity: 0;
                            transform: translate(0, 0) scale(0);
                        }

                        20% {
                            opacity: .8;
                            transform: translate(4px, 4px) scale(1);
                        }

                        100% {
                            opacity: 0;
                            transform: translate(11px, 11px) scale(.2);
                        }
                    }


                    /* =================================================
                       PARTICLE 4
                    ================================================= */

                    @keyframes particleFour {
                        0% {
                            opacity: 0;
                            transform: translate(0, 0) scale(0);
                        }

                        20% {
                            opacity: .8;
                            transform: translate(-4px, 4px) scale(1);
                        }

                        100% {
                            opacity: 0;
                            transform: translate(-10px, 11px) scale(.2);
                        }
                    }


                    /* =================================================
                       PAGE LOAD
                    ================================================= */

                    .brand-logo .logo-mark {
                        animation:
                            logoWelcome
                            900ms
                            cubic-bezier(.34,1.56,.64,1)
                            250ms
                            both;
                    }

                    .brand-logo .logo-sweep {
                        animation:
                            logoSweep
                            800ms
                            ease-out
                            500ms
                            both;
                    }

                    .brand-logo .particle-one {
                        animation:
                            particleOne
                            750ms
                            ease-out
                            500ms
                            both;
                    }

                    .brand-logo .particle-two {
                        animation:
                            particleTwo
                            800ms
                            ease-out
                            520ms
                            both;
                    }

                    .brand-logo .particle-three {
                        animation:
                            particleThree
                            750ms
                            ease-out
                            520ms
                            both;
                    }

                    .brand-logo .particle-four {
                        animation:
                            particleFour
                            700ms
                            ease-out
                            500ms
                            both;
                    }


                    /* =================================================
                       HOVER
                    ================================================= */

                    .group\\/logo:hover .logo-mark {
                        animation:
                            logoWelcome
                            800ms
                            cubic-bezier(.34,1.56,.64,1);
                    }

                    .group\\/logo:hover .logo-sweep {
                        animation:
                            logoSweep
                            700ms
                            ease-out;
                    }

                    .group\\/logo:hover .particle-one {
                        animation:
                            particleOne
                            700ms
                            ease-out;
                    }

                    .group\\/logo:hover .particle-two {
                        animation:
                            particleTwo
                            750ms
                            ease-out;
                    }

                    .group\\/logo:hover .particle-three {
                        animation:
                            particleThree
                            700ms
                            ease-out;
                    }

                    .group\\/logo:hover .particle-four {
                        animation:
                            particleFour
                            650ms
                            ease-out;
                    }


                    /* =================================================
                       REDUCED MOTION
                    ================================================= */

                    @media (prefers-reduced-motion: reduce) {
                        .brand-logo,
                        .brand-logo *,
                        .group\\/logo,
                        .group\\/logo * {
                            animation: none !important;
                            transition: none !important;
                        }
                    }
                `}
            </style>
        </span>
    );
}