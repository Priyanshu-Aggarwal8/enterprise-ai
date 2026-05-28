import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentWorkspaceComponent } from './agent-workspace.component';

describe('AgentWorkspaceComponent', () => {
  let component: AgentWorkspaceComponent;
  let fixture: ComponentFixture<AgentWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentWorkspaceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AgentWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
