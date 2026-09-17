---
title: "Linux"
date: 2026-09-17
tags: ["infrastructure", "linux", "aws", "nginx", "systemd", "monitoring"]
draft: false
---
> Linux 서버 운영 및 장애 분석 경험

### Question?
□ `top` / `htop`  
□ `ps`  
□ `free`  
□ `df`  
□ `du`  
□ `netstat` / `ss`  
□ `journalctl`  
□ `systemctl`  
□ `tail` / 로그 확인  
□ CPU 100%라면 무엇부터 볼 것인가  
□ memory 부족하면?  
□ disk full이면?  
□ process 죽었으면?

그리고 실제 AWS Ubuntu 장애 하나 준비.

**문제 → 확인한 것 → 원인 → 해결 → 재발방지**

---

### 프로세스 / CPU
- top / htop : CPU, 메모리 사용량, 어떤 프로세스가 많이 쓰는지 실시간 확인
- ps : 현재 실행 중인 프로세스 확인
```
ps aux | grep node
```


### 메모리
- free -h : 메모리 상태 확인 (메모리 사용량과 available memory를 확인)
- 다만 linux에서는 free가 작다고 무조건 메모리 부족은 아니다. cache/buffer도 활용하니 available을 같이 보는것이 중요하다.
```
              total    used    free
Mem:           3.8G    3.1G    200M
```


### Disk
- df -h : 파일시스템 전체 사용량
```
/dev/xvda1   30G   29G   1G   97%
```
- du -sh * : 어디가 많이 쓰는지


### Network / Port
- ss -lntp
- -l : listening
- -n : 숫자로 표시
- -t : TCP
- -p : process
- 3000번 포트에 node가 제대로 떠 있는지
```
ss -lntp | grep 3000
```


### systemctl
- linux의 systemd 서비스 관리
- systemctl status nginx
- sudo systemctl restart nginx


### journalctl
- systemd의 로그를 볼때
- journalctl -u nginx


### tail
- 애플리케이션 로그 파일을 직접 볼때 자주 사용
- tail -f app.log



### 서버가 갑자기 느립니다.
```
1. 서비스가 살아있는가?
   ↓
2. CPU / Memory / Disk 상태
   ↓
3. Process 확인
   ↓
4. Port / Network 확인
   ↓
5. Application / system log 확인
   ↓
6. DB / 외부 의존성 확인
```


### CPU 100% 라면?
- top/htop : 어떤 프로세스가 CPU를 먹는지 확인
- ps aux : PID 확인하고 로그를 본다
> “우선 top이나 htop으로 CPU를 많이 사용하는 프로세스를 확인하고, 해당 PID와 애플리케이션 로그를 확인하겠습니다. Node 프로세스라면 CPU-intensive 작업이나 무한 loop, scheduler 중복 실행 등이 있는지도 보겠습니다.”


### Memory 부족이라면?
- free -h
- top : 어떤 프로세스가 메모리를 많이 쓰는지 확인
- journalctl : 로그에서 OOM 관련 기록을 확인
> “free와 top을 통해 available memory와 프로세스별 사용량을 확인하고, 프로세스가 갑자기 종료된 경우 OOM Killer가 동작했는지도 system log에서 확인하겠습니다.”


### Disk full
- df -h
- du


### Process 죽었으면?
- ps aux | grep node
- systemctl status my-api
- journalctl -u my-api```
- systemctl restart my-api


### Nginx 장애라면?
- systemctl status nginx
- nginx -t
- tail -f /var/log/nginx/error.log
- ss -lntp



### AWS
- 운영체제 수준은 똑같아.
```
EC2 Ubuntu

top
free
df
ss
systemctl
journalctl
...
```

- 그런데 AWS에서는 추가로 인프라 영역도 볼 수 있어.
```
Security Group
Load Balancer health check
EC2 status check
CloudWatch
RDS/ElastiCache 상태
```

- 예를 들어 외부에서만 연결이 안 된다면 네트워크 계층을 봐야 하고.
```
프로세스는 정상
Port도 listen 중

그런데 외부 접속 안 됨

Security Group
NACL
Load Balancer
Nginx
```


### 마무리

> Linux 서버 운영 중 장애 해결한 경험 있나요?


```
문제
↓
확인
↓
원인
↓
해결
↓
재발 방지
```

예를 들어 **Nginx 502** 사례라면:

> **“운영 중 API 접근 시 502가 발생한 적이 있습니다. 우선 Nginx 자체가 정상인지 systemctl로 확인하고, error log를 확인했습니다. 이후 backend Node 프로세스와 listening port를 확인해서 upstream 서버가 정상적으로 응답하고 있는지 점검했습니다. 원인을 수정한 뒤 Nginx 설정을 검증하고 재기동했습니다. 이후에는 backend health check와 로그 확인을 통해 같은 문제가 발생했을 때 빠르게 원인을 찾을 수 있도록 했습니다.”**


> CPU 100%면요?

```
top 외웠어요!
```

보다:

> **“먼저 top으로 어떤 프로세스가 원인인지 범위를 좁히고, 해당 프로세스의 PID와 로그를 확인해서 애플리케이션 문제인지 시스템 문제인지 구분하겠습니다.”**

### 면접 직전 암기판

```
CPU
→ top / htop

Process
→ ps

Memory
→ free

Disk 전체
→ df

Directory별 Disk
→ du

Port / Socket
→ ss

Service
→ systemctl

Systemd Log
→ journalctl

File Log
→ tail
```

그리고 장애 대응은:

> **“우선 현상을 확인하고 CPU, memory, disk 같은 시스템 resource와 process 상태를 확인한 뒤, port/network와 application log를 통해 범위를 좁히겠습니다. 원인을 수정한 뒤에는 monitoring, health check, log rotation, 자동 복구 같은 재발 방지 방법도 검토하겠습니다.”**
