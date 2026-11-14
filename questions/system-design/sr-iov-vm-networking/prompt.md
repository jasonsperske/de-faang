# Design High-Performance VM Networking with SR-IOV

A cloud provider runs customer virtual machines on KVM hosts. Today every VM gets a paravirtual (virtio) NIC, and all packets go through a software virtual switch on the host. Large customers (databases, trading, ML training) complain about throughput, tail latency, and jitter, and the virtual switch burns a large share of every host's CPU cores.

The hosts have NICs that support **SR-IOV** (Single Root I/O Virtualization). Design the host networking that gives VMs near bare-metal network performance using SR-IOV, **without** giving up what the cloud's network already provides.

- **In scope:** the host data path and how a VM's NIC is presented to it, isolation between tenants, how the VPC overlay and security groups are still enforced, per-VM bandwidth limits, live migration and host maintenance, the control plane that allocates and configures virtual functions, and observability.
- **Out of scope:** the physical datacenter fabric and routing between hosts, and the guest operating system's own network stack tuning.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about NIC capabilities, VM density, performance targets, overlay networking, security, and migration. The interviewer has the numbers.
2. **Explain the building blocks**: physical and virtual functions, how a VF reaches a guest, and what the IOMMU does.
3. **Design the system**: the data path for a packet leaving a VM, where policy is enforced, and the control plane that sets it up.
4. **Go deep** on the hardest parts, such as keeping security groups and the overlay when traffic bypasses the host's software switch, live migration with a passthrough device, and isolation from a malicious guest.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.
