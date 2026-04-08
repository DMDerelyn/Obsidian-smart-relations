---
uuid: "5f492262-41b3-429e-b7ca-1c930527b6b9"
type: knowledge
status: reviewed
created: "2026-04-07"
modified: "2026-04-08"
tags: [science, physics, quantum, computing]
related: []
summary: "Introduction to quantum computing concepts including qubits, superposition, entanglement, and quantum gates."
---

# Quantum Computing

Quantum computing harnesses the principles of quantum mechanics to process information in fundamentally different ways than classical computers. While still in early stages, quantum computers promise to solve certain classes of problems that are intractable for even the most powerful classical supercomputers.

## Qubits

The basic unit of quantum information is the **qubit** (quantum bit). Unlike a classical bit, which is either 0 or 1, a qubit can exist in a **superposition** of both states simultaneously:

```
|psi> = alpha|0> + beta|1>
```

Here, alpha and beta are complex probability amplitudes. When measured, the qubit collapses to |0> with probability |alpha|^2 or |1> with probability |beta|^2, where |alpha|^2 + |beta|^2 = 1.

Physical implementations of qubits include:
- **Superconducting circuits** (IBM, Google): Josephson junctions cooled to near absolute zero
- **Trapped ions** (IonQ, Honeywell): Individual ions held in electromagnetic traps
- **Photonic qubits** (Xanadu): Individual photons encoding information in polarization
- **Topological qubits** (Microsoft): Exotic quasiparticles with inherent error protection

## Superposition

Superposition allows a quantum computer to explore multiple computational paths simultaneously. A system of *n* qubits can represent **2^n states at once**. This exponential scaling is the source of quantum computing's theoretical advantage:

- 10 qubits: 1,024 states
- 50 qubits: ~1 quadrillion states
- 300 qubits: More states than atoms in the observable universe

However, superposition is fragile. Any interaction with the environment --- heat, electromagnetic radiation, vibration --- can cause **decoherence**, collapsing the quantum state and destroying the computation.

## Entanglement

When two qubits are **entangled**, measuring one instantly determines the state of the other, regardless of the physical distance between them. Einstein famously called this "spooky action at a distance."

Entanglement is not just a curiosity; it is a computational resource. Entangled qubits can encode correlations that have no classical equivalent, enabling:

- **Quantum teleportation**: Transferring quantum states between locations
- **Superdense coding**: Sending two classical bits using one qubit
- **Quantum error correction**: Distributing information across entangled qubits for fault tolerance

## Quantum Gates

Quantum gates are the operations that manipulate qubits, analogous to logic gates in classical computing:

| Gate | Effect | Classical Analog |
|------|--------|-----------------|
| X (NOT) | Flips |0> to |1> and vice versa | NOT gate |
| H (Hadamard) | Creates superposition from a basis state | No classical analog |
| CNOT | Flips target qubit if control qubit is |1> | Conditional NOT |
| T (Phase) | Adds a phase to the |1> component | No classical analog |
| Toffoli | CNOT with two control qubits | AND gate |

Quantum circuits are built by composing these gates. Unlike classical gates, quantum gates must be **reversible** (unitary), meaning no information is lost during computation.

## Applications and Challenges

Promising applications include #quantum-algorithms for:

- **Cryptography**: Shor's algorithm can factor large numbers, threatening RSA encryption
- **Optimization**: Quantum annealing and variational algorithms for logistics, finance, and drug design
- **Simulation**: Modeling molecular interactions for chemistry and materials science
- **Machine learning**: Quantum-enhanced feature spaces and sampling

The primary challenge remains **error rates**. Current "noisy intermediate-scale quantum" (NISQ) devices have error rates of roughly 0.1-1% per gate, far too high for many algorithms. Achieving fault-tolerant quantum computing likely requires millions of physical qubits to encode thousands of logical qubits.
