# Task 11: Ansible Deployment

## Objective
Create Ansible playbooks and roles for automated deployment to cori_celesti/Umbrel server.

## Output Location
`octiron/calendar-site/ansible/`

## Deliverables

### 1. ansible/inventory
```ini
[umbrel]
10.227.6.155 ansible_user=aldus ansible_ssh_private_key_file=~/.ssh/codsworth
```

### 2. ansible/ansible.cfg
```ini
[defaults]
inventory = inventory
host_key_checking = False
```

### 3. ansible/playbooks/deploy-calendar-site.yml
```yaml
---
- name: Deploy Calendar Site
  hosts: umbrel
  become: yes
  
  tasks:
    - name: Create app directory
      file:
        path: /home/aldus/calendar-site
        state: directory
        owner: aldus
        group: aldus
    
    - name: Copy Docker Compose file
      copy:
        src: ../../docker-compose.prod.yml
        dest: /home/aldus/calendar-site/docker-compose.yml
    
    - name: Copy Dockerfile.backend
      copy:
        src: ../../Dockerfile.backend
        dest: /home/aldus/calendar-site/Dockerfile.backend
    
    - name: Copy Dockerfile.frontend
      copy:
        src: ../../Dockerfile.frontend
        dest: /home/aldus/calendar-site/Dockerfile.frontend
    
    - name: Copy frontend nginx config
      copy:
        src: ../../frontend/nginx.conf
        dest: /home/aldus/calendar-site/nginx.conf
    
    - name: Copy backend source
      synchronize:
        src: ../../backend/
        dest: /home/aldus/calendar-site/backend/
        delete: yes
    
    - name: Copy frontend source
      synchronize:
        src: ../../frontend/
        dest: /home/aldus/calendar-site/frontend/
        delete: yes
    
    - name: Ensure data directory exists
      file:
        path: /data/calendar
        state: directory
        owner: aldus
        group: aldus
    
    - name: Build and start containers
      community.docker.docker_compose:
        project_src: /home/aldus/calendar-site
        files:
          - docker-compose.yml
        build: yes
        state: present
      
    - name: Wait for service
      uri:
        url: http://localhost:3000/health
        status_code: 200
      register: result
      until: result.status == 200
      retries: 10
      delay: 3
```

### 4. ansible/roles/calendar-site/ (alternative structure)
If using roles:
```
ansible/roles/calendar-site/
├── tasks/
│   └── main.yml
├── handlers/
│   └── main.yml
└── templates/
    └── docker-compose.yml.j2
```

### 5. systemd service file (optional but recommended)
Create via Ansible template:
```ini
# /etc/systemd/system/calendar-site.service
[Unit]
Description=Calendar Site
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/aldus/calendar-site
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
```

## Success Criteria
- [ ] `ansible-playbook playbooks/deploy-calendar-site.yml --check` (dry run) passes
- [ ] `ansible-playbook playbooks/deploy-calendar-site.yml` deploys successfully
- [ ] Application accessible at http://10.227.6.155:8080 (or configured port)
- [ ] API responds at /api/health
- [ ] Data persists in /data/calendar/ on server
- [ ] Containers restart on server reboot (if systemd service enabled)

## Testing Commands
```bash
# From ansible directory
cd octiron/calendar-site/ansible

# Check inventory
ansible all -i inventory -m ping

# Dry run
ansible-playbook playbooks/deploy-calendar-site.yml --check

# Deploy
ansible-playbook playbooks/deploy-calendar-site.yml

# Verify on server
ssh aldus@10.227.6.155
curl http://localhost:3000/health
curl http://localhost:8080/api/health
```

## Context from Spec
- Target: cori_celesti/Umbrel server (10.227.6.155)
- User: aldus
- SSH key: ~/.ssh/codsworth
- Data path: /data/calendar/
- Pattern: Same as Expense Tracker deployment

## Dependencies
- Task 1-4 (Project setup) - needs source files to deploy
- Task 10 (Docker) - needs Docker files

## Independent From
- Component implementation details
- Can use placeholder files for initial setup

## Blocks
- Task 12 (Integration Testing) - needs deployment for final testing

## Notes
- Ensure Docker and Docker Compose installed on target server
- Consider using docker-compose module vs command based on Ansible version
- May need to install community.docker collection: `ansible-galaxy collection install community.docker`
