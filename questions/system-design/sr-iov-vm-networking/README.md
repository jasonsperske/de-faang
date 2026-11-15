# Design High-Performance VM Networking with SR-IOV

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `virtualization` `networking` `sr-iov` `isolation`

A cloud provider runs customer virtual machines on KVM hosts. Today every VM gets a paravirtual (virtio) NIC, and all packets go through a software virtual switch on the host. Large customers (databases, trading, ML training) complain about throughput, tail latency, and jitter, and the virtual switch burns a large share of every host's CPU cores.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`system-design`](../../../rubrics/README.md#system-design) (System design interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Requirements & scoping | 20% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Strong answers explain the mechanics precisely, then notice that naive SR-IOV bypasses the host's software switch and with it every network feature the cloud relies on, and design the offload, isolation and migration story around that. Building blocks: SR-IOV lets one PCIe device expose a physical function (PF, full-featured, owned by the host driver) and many lightweight virtual functions (VFs, each with its own PCIe requester ID, queues and MSI-X vectors). A VF is bound to vfio-pci on the host and passed through to the guest, which runs the vendor VF driver and does DMA directly into its own memory; the IOMMU (VT-d / AMD-Vi) restricts each VF's DMA to that guest's memory and interrupt remapping stops forged interrupts; ACS on PCIe switches keeps VFs in separate IOMMU groups. Result: no vmexits or host copies per packet, close to line rate and microsecond latency, and host cores freed. Problem: traffic now goes VF -> NIC embedded switch (eswitch) -> wire, skipping the host vswitch, so VPC overlay encapsulation (VXLAN/Geneve), security groups, flow logs, and rate limits must happen in the NIC. Options: (1) legacy SR-IOV with per-VF MAC/VLAN, spoof check, trust off and max_tx_rate: isolation and simple QoS, but no overlay or stateful security groups; (2) eswitch in switchdev mode with VF representors on the host, OVS (kernel or DPDK) as the slow path that sees the first packet of each flow, applies policy and installs offloaded flow rules (TC flower) for encap/decap, NAT and connection tracking in NIC hardware, so subsequent packets never touch host CPU; must handle flow-table capacity, rule-insertion rate, aging, and fall back to software when tables are full, with per-tenant limits so one tenant can't evict others; (3) DPU/SmartNIC running the whole virtual network on its own cores (Nitro-style), the host never sees tenant traffic and the hypervisor footprint shrinks; (4) vDPA: the guest sees a standard virtio device while the data path is hardware, which fixes guest-driver and migration problems. Live migration: a passthrough VF's device state normally can't be migrated, so either pair the VF with a standby virtio NIC in a failover bond (net_failover / QEMU failover: hot-unplug the VF before migration, traffic shifts to virtio through the software path, migrate, hot-plug a new VF on the destination, with a short throughput dip), or use vendor VFIO migration support or vDPA so device state moves with the VM. Control plane: a host agent inventories PFs and VFs (NIC limit, firmware, NUMA node), creates VFs at boot, reports capacity to the scheduler (VFs per host and per NUMA node become a schedulable resource alongside CPU and memory), and on VM create assigns a VF on the VM's NUMA node, sets MAC, VLAN or VNI, spoof check, rate limits, installs representor policy, and attaches it via vfio; on delete it does an FLR and scrubs the VF before reuse. QoS: per-VF tx/rx limits and hardware queue scheduling; PCIe and NIC bandwidth are shared, so overcommit and noisy-neighbour limits matter. Observability: per-VF and representor counters, offload hit/miss rates, flow-table occupancy, dropped-by-policy counters exported per VM; mirroring or sampling for flow logs happens in the slow path or the NIC. Rollout: enable per instance type, keep virtio as the default and the fallback, firmware and driver version matrix, guest images must ship the VF driver.

**Common pitfalls**

- Describing SR-IOV only as 'faster networking' without PFs, VFs, vfio passthrough, and the IOMMU's role in isolation.
- Passing VFs straight through and forgetting that the VPC overlay, security groups, flow logs, and per-VM rate limits were implemented in the bypassed software switch.
- Trusting the guest: leaving VF trust on, no MAC or VLAN spoof checking, or no IOMMU or interrupt remapping.
- Assuming VMs with passthrough devices can live-migrate like any other VM, with no plan for host maintenance.
- Ignoring hardware limits: the number of VFs per PF, flow-offload table size and insertion rate, and NUMA placement of the VF relative to the VM's vCPUs.
- No fallback when offload fails or a guest lacks the VF driver, and no way for the scheduler to know which hosts still have free VFs.
- Reusing a VF for a new tenant without a function-level reset.

**Likely deep dives**

- SR-IOV building blocks: PFs, VFs, vfio passthrough, IOMMU and interrupt remapping, IOMMU groups and ACS
- Keeping VPC overlay and stateful security groups: switchdev eswitch, representors, slow path plus hardware flow offload, table-full fallback
- Live migration with passthrough devices: failover bonding with virtio, VFIO device migration, vDPA
- Tenant isolation and QoS: spoof checking, trust, rate limits, FLR on reuse, noisy neighbours
- Control plane: VF inventory, NUMA-aware scheduling, configuration, and observability

</details>

## Follow-up questions

Asked in writing after you submit.

- Walk through a packet leaving a VM through its VF to another tenant VM on a different host, naming every place an address is translated, encapsulated, or checked against policy. Where does the host CPU touch it, if anywhere?
- A guest with a VF passed through is fully controlled by a malicious tenant. List what they could try (DMA into host memory, MAC or VLAN spoofing, flooding the PF, interrupt storms, buggy firmware commands) and which mechanism stops each.
- The host needs a kernel patch, so all 40 VMs must live-migrate off it within an hour. How does migration work when each VM owns a VF, what does the guest see during the move, and what would you need from the NIC vendor to make it seamless?
- Your NIC's flow-offload table holds about a million entries, and one customer opens millions of short connections. What happens to their traffic and to their neighbours', and how do you design the fallback?
- When would you choose virtio with a fast software switch (vhost or DPDK), plain SR-IOV, SR-IOV with a switchdev eswitch, vDPA, or a DPU/SmartNIC that owns the whole data path? What does each cost in performance, flexibility and operations?

## Study resources

- [Wikipedia — Single-root input/output virtualization](https://en.wikipedia.org/wiki/Single-root_input/output_virtualization)
- [Linux kernel docs — PCI Express I/O Virtualization Howto](https://docs.kernel.org/PCI/pci-iov-howto.html)
- [Linux kernel docs — VFIO (Virtual Function I/O)](https://docs.kernel.org/driver-api/vfio.html)
- [OASIS — Virtual I/O Device (VIRTIO) specification v1.2](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html)
- [Linux kernel docs — NET_FAILOVER](https://docs.kernel.org/networking/net_failover.html)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)
